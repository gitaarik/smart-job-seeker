/**
 * Making a version the text, which is the one thing the version verbs cannot do.
 *
 * `text-version-capabilities.ts` says so in its own doc comment, under "What
 * they deliberately cannot do": nothing there makes a version the live text,
 * because an agent that can approve its own proposal has not been through an
 * approval. That sentence is still true of that mechanism, and this file does
 * not weaken it. It adds a verb that ASKS, and the asking is a Tier 2 request —
 * recorded, linked, and decided by a person on `/data/ai-changes` under a
 * session of their own. There is still no tool here that approves anything.
 *
 * ## What this buys, since it is not "one fewer approval"
 *
 * It is the same number of decisions, in one place instead of four. Committing
 * a version by hand means opening each text, finding the entry, and pressing
 * "Use as …"; three waiting versions are three pages. The approval feed already
 * renders a full before/after with the shrinkage warning the timeline shows,
 * so the same judgement is made from one list — and, unlike the button on the
 * page, what it does is undoable from that feed afterwards.
 *
 * ## Why this is Tier 2 always, and not "Tier 2 unless the text was empty"
 *
 * `tierForWrite` would grade a first commit onto an empty text as additive,
 * which is true of that one write and false of the sequence it completes.
 * `add_<kind>` starts an empty row (Tier 1, because it is empty),
 * `add_<kind>_version` writes a version beside it (Tier 1, because the text
 * does not change), and a Tier 1 commit would then put a whole document on the
 * profile without anyone having read a word of it. Each step is additive and
 * the three together are not, which is exactly the hole `text-create-
 * capabilities.ts` refuses to open by not accepting content on a create. So
 * `tierFor` answers 2 unconditionally, and the reason it gives is the one the
 * agent reads when its call comes back unapplied.
 *
 * ## Why the card cannot show what the fields hold
 *
 * The field is a version id, because that is the honest handle: the text being
 * committed already exists, the applicant has it in front of them in the
 * timeline, and re-sending it would let the two drift. But an approval card
 * built from that field says "Version id: 2 → 4", which asks somebody to
 * approve a text nobody showed them. So these declare `describeChanges` and
 * hand the feed the two texts instead. That hook exists for this shape and is
 * documented on `CapabilityDef`.
 */

import { buildConversation, readVersion } from './entity-versions';
import {
	TEXT_KINDS,
	TEXT_KIND_NAMES,
	readOwnedText,
	type TextKind
} from '$lib/server/texts/profile-texts';
import { normalizeForKind } from './text-version-capabilities';
import { sameText } from '$lib/utils/same-text';
import type { VersionSource } from './entity-versions';
import type {
	CapabilityActor,
	CapabilityDef,
	CapabilityTarget,
	ProposedChange
} from './capabilities';

export type TextCommitCapability = `use_${TextKind}_version`;

export const TEXT_COMMIT_CAPABILITY_NAMES = TEXT_KIND_NAMES.map(
	(kind) => `use_${kind}_version` as TextCommitCapability
);

/** The kind a capability commits to, from its name. */
export function kindForTextCommitCapability(capability: TextCommitCapability): TextKind {
	return capability.slice('use_'.length, -'_version'.length) as TextKind;
}

export function isTextCommitCapability(name: string): name is TextCommitCapability {
	return (TEXT_COMMIT_CAPABILITY_NAMES as string[]).includes(name);
}

/**
 * The wire name this kind's version id goes by.
 *
 * Prefixed for the reason every field on this surface is: the chat merges every
 * live capability's fields into one object for the provider, and four
 * capabilities all offering `version_id` would be one collision away from a
 * story's version landing on a cover letter.
 */
export function textVersionFieldName(kind: TextKind): string {
	return `${kind}_version_id`;
}

/** One version of the text, as `current` reports it. Never carries the content. */
interface TrailEntry {
	id: number;
	chars: number;
	source: VersionSource;
	at: string | null;
}

/**
 * The timeline as a capability sees it: which versions there are, and which one
 * the text is already showing.
 *
 * Lengths and not contents. `validate` has to know that a version exists and is
 * not the live one, which the ids answer; the text itself is read once, by id,
 * at the two moments it is actually needed (`beforeImage` for the card,
 * `apply` for the write). Putting every version's content in here would carry
 * the whole trail through the tier decision and into the prompt.
 *
 * "Which one is live" is decided by trimmed equality against the row, which is
 * the rule the editor's own "Current …" badge uses in ConversationTimeline. It
 * must not be cleverer than that: the applicant is looking at that badge, and a
 * capability that disagreed with it would refuse a commit they can see is
 * needed, or offer one they can see is done.
 */
async function currentState(
	kind: TextKind,
	target: CapabilityTarget,
	actor: CapabilityActor
): Promise<Record<string, unknown>> {
	const field = textVersionFieldName(kind);
	const row = await readOwnedText(kind, target.id, actor.profileId);
	if (!row) return { [field]: null, text: '', versions: [] };

	const committed = normalizeForKind(kind, row.committed ?? '');
	const trail = await buildConversation(TEXT_KINDS[kind].versions, target.id);

	// A version carrying no content is an advice turn: a turn in the thread
	// rather than a version of the text. Same rule `summarizeVersions` applies,
	// and the two have to agree or an agent commits something the list it read
	// never showed it.
	const withText = trail.filter((entry) => (entry.content ?? '').trim());

	const versions: TrailEntry[] = withText.map((entry) => ({
		id: entry.versionId,
		chars: (entry.content ?? '').length,
		source: entry.type,
		at: entry.date ? entry.date.toISOString() : null
	}));

	// The newest match, not the first. A text committed, revised and committed
	// back has two versions holding the same words, and the badge sits on the
	// later one.
	const live =
		[...withText]
			.reverse()
			.find((entry) => sameText(normalizeForKind(kind, entry.content ?? ''), committed)) ?? null;

	return {
		[field]: live?.versionId ?? null,
		// The text as the row holds it, which is what an undo puts back. Not the
		// newest version — that is what `add_<kind>_version` reports and the
		// opposite of the question here.
		text: row.committed ?? '',
		versions
	};
}

function contractFor(kind: TextKind): string {
	const { noun } = TEXT_KINDS[kind];
	const field = textVersionFieldName(kind);

	return `Make one version of a ${noun} the text it actually says.

The counterpart to add_${kind}_version, which writes a version and changes
nothing. This is the step that changes something, and it is the applicant's to
take: the call records a request and returns a link, they compare the two texts
on their Recent Changes page and approve or decline. Nothing is written when
this returns. Report it as waiting, never as done.

- "${field}" is REQUIRED and is the id of a version already in this ${noun}'s
  timeline. read_text returns them as "version_id"; list_texts returns the
  newest as "latest_version_id". It is not a version number, not a count, and
  not the ${noun}'s own id.

Use it when the applicant has asked for the ${noun} to be updated, on a version
they know about — usually one you have just written for them and told them
about. Not to tidy up after yourself: a version you wrote a moment ago and are
now asking to commit in the same breath is one decision presented as two, and
the applicant reads both.

Check "latest_is_current" from list_texts first. True means the newest version
is already what the ${noun} says and there is nothing here to do.`;
}

function capabilityFor(kind: TextKind): CapabilityDef {
	const def = TEXT_KINDS[kind];
	const field = textVersionFieldName(kind);

	return {
		title: `Use a version as the ${def.noun}`,

		// Addressed by id, never by page, exactly as the version verbs are: each
		// of these texts has a conversational editor of its own, and that editor
		// is where a person does this with a button. MCP resolves through
		// `mcp/entities.ts`, which is asked first and never falls through here.
		resolve: async () => null,

		authorize: async (target, actor) =>
			(await readOwnedText(kind, target.id, actor.profileId)) !== null,

		current: (target, actor) => currentState(kind, target, actor),

		fields: { [field]: 'int' },

		// A commit with no version named is not a smaller commit; there is nothing
		// to commit. Said in the schema so the call is not made, rather than only
		// in `validate`, which answers after the model has committed to it.
		requiredFields: [field],

		contract: contractFor(kind),

		// Unconditional, and the reason it is unconditional is in this file's doc
		// comment: an empty text makes this write additive on its own and not in
		// the sequence that reaches it.
		tierFor: () => ({
			tier: 2,
			reason:
				`Putting a version on the ${def.noun} changes what it says, which is the ` +
				`applicant's to decide even when they asked for the version.`
		}),

		renderState: (state) => {
			const versions = Array.isArray(state.versions) ? (state.versions as TrailEntry[]) : [];
			if (versions.length === 0) return `The ${def.noun} has no versions to take.`;

			const live = state[field];
			const lines = versions.map(
				(version) =>
					`  - version ${version.id}: ${version.chars} characters, ${version.source}` +
					`${version.id === live ? ' — this is what it says now' : ''}`
			);

			return (
				`Versions of this ${def.noun}, oldest first:\n\n${lines.join('\n')}` +
				(live === null
					? `\n\nNone of them is the text as it stands — it was edited without one.`
					: '')
			);
		},

		validate: (fields, current) => {
			const raw = fields[field];
			const versionId = typeof raw === 'number' && Number.isInteger(raw) ? raw : null;
			const versions = Array.isArray(current.versions) ? (current.versions as TrailEntry[]) : [];

			if (versionId === null) {
				return {
					ok: false,
					error:
						`"${field}" must be the id of a version in this ${def.noun}'s timeline. ` +
						`read_text returns them as "version_id".`
				};
			}

			if (versions.length === 0) {
				return {
					ok: false,
					error:
						`This ${def.noun} has no versions to take. Write one with ` +
						`add_${kind}_version first — this verb commits a version, it does not ` +
						`make one.`
				};
			}

			if (!versions.some((version) => version.id === versionId)) {
				return {
					ok: false,
					error:
						`Version ${versionId} is not in this ${def.noun}'s timeline. It has ` +
						`${versions.map((version) => version.id).join(', ')}. Ids are per text, ` +
						`so a version id from another ${def.noun} names nothing here.`
				};
			}

			// Also caught earlier by the MCP write path, which drops a field whose
			// value the row already holds and answers "nothing to change". This is
			// the same refusal at approval time, where that narrowing has long
			// since run and the applicant may have pressed the button themselves in
			// between.
			if (current[field] === versionId) {
				return {
					ok: false,
					error: `Version ${versionId} is already what the ${def.noun} says.`
				};
			}

			return { ok: true };
		},

		/**
		 * Both texts, so the card can show a diff and an undo can put one back.
		 *
		 * `text` is the before-image proper — what the row held, which is what
		 * `revert` writes. `version_text` is not a before-image at all; it is the
		 * after, stored because the feed renders from a saved row and has no
		 * database to resolve an id against. See `describeChanges`.
		 */
		beforeImage: async (target, current, _actor, fields) => {
			const versionId = Number(fields[field]);
			const version = await readVersion(def.versions, target.id, versionId);

			return {
				text: typeof current.text === 'string' ? current.text : '',
				version_text: version?.content ?? '',
				version_id: versionId
			};
		},

		describeChanges: (_fields, previous): ProposedChange[] => {
			const from = typeof previous.text === 'string' ? previous.text : '';
			const to = typeof previous.version_text === 'string' ? previous.version_text : '';
			if (sameText(from, to)) return [];

			// One change and not two: an id moving from 2 to 4 is the mechanism,
			// and the text is the decision. `field` is the render key only.
			return [{ field: 'content', label: 'Text', from, to }];
		},

		apply: async (target, fields, _current, actor) => {
			const versionId = Number(fields[field]);
			const version = await readVersion(def.versions, target.id, versionId);

			// Read again rather than taken from the request. A stored request holds
			// what a model sent, possibly a week ago, and `requests.ts` is explicit
			// that nothing in it is trusted on the way back out. `validate` has
			// already run against a fresh trail, so this is the unreachable half of
			// that check rather than the check itself — and unreachable is where it
			// belongs, because the alternative is writing an empty text over a
			// letter on the strength of a stale id.
			if (!version || !(version.content ?? '').trim()) {
				throw new Error(
					`Version ${versionId} is no longer in this ${def.noun}'s timeline, so there ` +
						`is nothing to put on it.`
				);
			}

			await def.setText(target.id, actor.profileId, normalizeForKind(kind, version.content ?? ''));
		},

		revert: async (target, previous, actor) => {
			// An absent key is a log row this capability cannot read, not a commit
			// onto an empty text — which is a real case and records `""`. Writing
			// the current text back over itself would report a successful undo and
			// undo nothing.
			if (!('text' in previous)) {
				throw new Error(`use_${kind}_version recorded no text this can put back`);
			}

			const text = typeof previous.text === 'string' ? previous.text : null;
			await def.setText(target.id, actor.profileId, text || null);
		}

		// No `appliedNote`. That sentence is what MCP prints when a write lands
		// directly, and `tierFor` above means one never does: every call of these
		// comes back as a request with a link. What the agent is told instead is
		// the tier's own reason, which is why it is written as a sentence to read.
	};
}

export const TEXT_COMMIT_CAPABILITIES: Record<TextCommitCapability, CapabilityDef> =
	Object.fromEntries(
		TEXT_KIND_NAMES.map((kind) => [`use_${kind}_version`, capabilityFor(kind)])
	) as Record<TextCommitCapability, CapabilityDef>;
