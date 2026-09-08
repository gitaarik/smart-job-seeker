/**
 * Writing a new version of a text the applicant is drafting, without changing
 * what the text currently says.
 *
 * ## Why this is additive, which is the whole design
 *
 * A letter, an answer, a story and a cheat sheet each keep an append-only trail
 * beside them (`entity-versions.ts`), and the app's own AI editor never writes
 * the committed column: `application-letter-followup.ts` records a version and
 * stops. The applicant commits by saving one, from a timeline that shows the
 * diff and offers a delete on every entry.
 *
 * So a version written from here replaces nothing. It arrives where the
 * editor's own proposals arrive, labelled as having come from a connected app
 * (`agent_revision`), and the text on the letter is whatever it was until a
 * person decides otherwise. That is why these are `add_` verbs and Tier 1 —
 * additive, reversible, visible — rather than the Tier 2 an overwrite of
 * authored prose would earn. The propose-then-confirm step is not bolted on
 * here; it is the mechanism the feature already had.
 *
 * ## Generated, for the reason the profile sections are
 *
 * Four kinds, one verb, one shape: read the text, append a version, say where
 * it is waiting. Hand-writing that four times would be four copies of one
 * contract drifting apart at three of them. What differs between the kinds —
 * how a row is scoped to a profile, which column holds the text, where a person
 * opens it — is declared once in `texts/profile-texts.ts` and read from there.
 *
 * ## What they deliberately cannot do
 *
 * **Commit.** Nothing here makes a version the live text, for the same reason
 * there is no undo tool on this server: an agent that can approve its own
 * proposal has not been through an approval.
 *
 * **Create the text itself.** These verbs reach a row that exists and do
 * nothing else. A letter and a question are still made only in the app, because
 * both are claims about an employer. A story and a cheat sheet can now be
 * started from outside, in `text-create-capabilities.ts`, but by a separate verb
 * that sets a title and leaves the text empty, so the words still arrive here,
 * as a version somebody takes. Proposing versions of things nobody asked for is
 * how a timeline fills with work nobody wanted, and the guard against it is the
 * duplicate check on the create rather than the absence of one.
 *
 * **Rewrite what it has not read.** A text longer than one `read_text` slice is
 * refused rather than rewritten from the part that fit — see `validate`.
 */

import { ensureBaselineVersion, recordVersion, type VersionSource } from './entity-versions';
import {
	TEXT_KINDS,
	TEXT_KIND_NAMES,
	TEXT_READ_CHARS,
	readOwnedText,
	summarizeTextVersions,
	type TextKind
} from '$lib/server/texts/profile-texts';
import { parseStarMarkdown, serializeStarMarkdown } from '$lib/interview/star';
import type { CapabilityActor, CapabilityDef, CapabilityTarget } from './capabilities';

/** The provenance every version written from this server carries. */
const AGENT_SOURCE: VersionSource = 'agent_revision';

export type TextCapability = `add_${TextKind}_version`;

export const TEXT_CAPABILITY_NAMES = TEXT_KIND_NAMES.map(
	(kind) => `add_${kind}_version` as TextCapability
);

/** The kind a capability writes, from its name. */
export function kindForTextCapability(capability: TextCapability): TextKind {
	return capability.slice('add_'.length, -'_version'.length) as TextKind;
}

export function isTextCapability(name: string): name is TextCapability {
	return (TEXT_CAPABILITY_NAMES as string[]).includes(name);
}

/**
 * The wire names one kind's fields go by.
 *
 * Prefixed for the reason every capability's fields are: the chat merges every
 * live capability's fields into one object for the provider, and four
 * capabilities all offering `content` would be one collision waiting for two of
 * them to be live at once.
 */
export function textFieldNames(kind: TextKind): { content: string; note: string } {
	return { content: `${kind}_content`, note: `${kind}_note` };
}

/**
 * The text as it stands, for a capability rather than for a reader.
 *
 * `readProfileText` answers a larger question — the trail, a slice, an offset —
 * which is what a read TOOL needs and more than `current` wants: this is asked
 * on every call, including the ones that end in a refusal.
 *
 * `text` follows the same rule the app's own revision path does: the newest
 * version's content, falling back to the committed column. `latest_is_current`
 * carries the difference between the two, which is the fact that decides
 * whether proposing anything is useful at all.
 */
async function currentState(
	kind: TextKind,
	target: CapabilityTarget,
	actor: CapabilityActor
): Promise<Record<string, unknown>> {
	const row = await readOwnedText(kind, target.id, actor.profileId);
	if (!row) return { text: '', chars: 0, versions: 0, latest_is_current: true };

	const trail = (await summarizeTextVersions(kind, [target.id])).get(target.id);
	const committed = row.committed ?? '';
	const newest = trail?.latest.content ?? '';
	const text = newest || committed;

	return {
		text,
		chars: text.length,
		versions: trail?.count ?? 0,
		latest_is_current: !newest || newest.trim() === committed.trim()
	};
}

/**
 * Normalize a proposed version the way the editor would store it.
 *
 * Only a story needs it: its trail carries canonical STAR markdown, and a
 * version that is not canonical cannot be compared with the story's own columns
 * — which is how the timeline decides whether a version is the live one. Text
 * with no recognizable heading degrades to the whole blob in Situation rather
 * than being dropped, which is `star.ts`'s rule and not this file's.
 *
 * Exported for `text-commit-capabilities.ts`, which asks the same question from
 * the other end: whether a version in the trail is the text the row already
 * holds. Two copies of this would answer that differently for exactly the kind
 * it exists for, and the disagreement would read as a story that can never be
 * committed because it never matches itself.
 */
export function normalizeForKind(kind: TextKind, content: string): string {
	return kind === 'story' ? serializeStarMarkdown(parseStarMarkdown(content)) || content : content;
}

/** What this kind is, said once, in the terms its own editor uses. */
function subjectFor(kind: TextKind): string {
	switch (kind) {
		case 'question':
			return (
				`The answer to one application question. Read the question itself — it comes ` +
				`back from read_text as "prompt" — before writing to it: an answer is judged ` +
				`against what was asked, and that is the only place the asking appears.`
			);
		case 'story':
			return (
				`One STAR story from Interview Prep. Its sections are headed "## Situation", ` +
				`"## Task", "## Action", "## Result" and "## Reflection" — write the whole ` +
				`document with those headings, in that order, omitting a heading whose section ` +
				`is empty. Text under no heading is kept rather than dropped, but all of it ` +
				`lands in Situation, which is rarely what you meant.`
			);
		case 'cheat_sheet':
			return (
				`One interview cheat sheet from Interview Prep. Not the letter whose type is ` +
				`also called "cheat sheet": that one is a letter on an application, and ` +
				`add_letter_version writes it.`
			);
		default:
			return (
				`One letter on an application — a cover letter, or the letter-shaped cheat ` +
				`sheet written on the same tab.`
			);
	}
}

function contractFor(kind: TextKind): string {
	const noun = TEXT_KINDS[kind].noun;
	const { content, note } = textFieldNames(kind);

	return `${subjectFor(kind)}

**This does not change the ${noun}.** It adds a version to the ${noun}'s
timeline, where the applicant compares it against what is there now and either
keeps it or deletes it. Until they do, the ${noun} says exactly what it said
before. Report it that way: you wrote a version for them to look at, not a
${noun} you have updated.

Fields:
- "${content}" is the COMPLETE new text and is REQUIRED. Not a diff, not the
  paragraph you changed, not instructions for changing it — what you send is the
  whole version, and anything you leave out is missing from it. The applicant
  sees exactly that, as a deletion, in the diff.
- "${note}" is what you changed and why, in a sentence or two. It appears beside
  the diff where the app's own editor puts its notes. Write it for them: it is
  the difference between a version they can judge at a glance and one they have
  to reverse-engineer.

Before writing one:
- Call read_text and read what the ${noun} says now. A rewrite of something you
  have not read is a guess and reads like one.
- Read what it is answering: read_job for what the employer asked, and
  read_profile_section for what the applicant actually has. A ${noun} improved
  without either is prose polishing.
- Check "latest_is_current". False means a version is already waiting that
  nobody has taken. Say so and stop rather than stacking another on top of it —
  two unread proposals are not twice the help.

Rewriting a whole text loses material, reliably and regardless of how the
instruction is worded: a measured tenth to a quarter of the concrete detail goes
missing when a model is asked to rewrite a passage. Carry over every number,
name, date and claim the text holds now unless you are cutting it deliberately,
and say in "${note}" what you cut. Never add a fact the applicant's own record
does not support — rewording what they wrote is yours to propose; an employer,
a date or an achievement is not.`;
}

function capabilityFor(kind: TextKind): CapabilityDef {
	const def = TEXT_KINDS[kind];
	const { content, note } = textFieldNames(kind);

	return {
		title: `Write a new version of a ${def.noun}`,

		// Addressed by id, never by page. Each of these texts has a conversational
		// editor of its own — this mechanism is that editor's — so there is no page
		// entity that resolves to one and nothing for the chat to offer. Null is
		// the honest answer rather than an oversight: MCP resolves through
		// `mcp/entities.ts`, which is asked first and never falls through to this.
		resolve: async () => null,

		authorize: async (target, actor) =>
			(await readOwnedText(kind, target.id, actor.profileId)) !== null,

		current: (target, actor) => currentState(kind, target, actor),

		fields: { [content]: 'string', [note]: 'string' },

		// The text, and not the note. A version with no text is not a smaller
		// version; there is nothing to put in the timeline. Saying so in the schema
		// is what stops the call being made rather than refused.
		requiredFields: [content],

		contract: contractFor(kind),

		renderState: (state) => {
			const chars = Number(state.chars ?? 0);
			const versions = Number(state.versions ?? 0);
			if (chars === 0) return `The ${def.noun} is empty.`;
			return (
				`The ${def.noun} is ${chars} characters over ${versions} ` +
				`${versions === 1 ? 'version' : 'versions'}.` +
				(state.latest_is_current === false
					? ` The newest version is not what the ${def.noun} holds — the applicant has ` +
						`not taken it yet, so do not propose another.`
					: '')
			);
		},

		validate: (fields, state) => {
			const raw = fields[content];
			const proposed = typeof raw === 'string' ? raw.trim() : '';
			if (!proposed) {
				return { ok: false, error: `The version has no text — "${content}" is required.` };
			}

			const existing = typeof state.text === 'string' ? state.text : '';

			// Refused rather than truncated. A text this long came back from
			// read_text in slices, so a rewrite of it is a rewrite of the first
			// slice, and everything past it would disappear from the version with
			// nothing saying so.
			if (existing.length > TEXT_READ_CHARS) {
				return {
					ok: false,
					error:
						`This ${def.noun} is ${existing.length} characters, longer than the ` +
						`${TEXT_READ_CHARS} one read returns — a version written from here would ` +
						`drop everything past the part you could see. The applicant edits it in ` +
						`the app (${def.collection.path}).`
				};
			}

			if (normalizeForKind(kind, proposed).trim() === existing.trim()) {
				return { ok: false, error: `That is word for word what the ${def.noun} already says.` };
			}

			return { ok: true };
		},

		apply: async (target, fields, current) => {
			const proposed = normalizeForKind(kind, String(fields[content]).trim());
			const written = typeof fields[note] === 'string' ? fields[note].trim() : '';

			// A text written before the trail existed has no version rows, so without
			// this the agent's version becomes the ONLY one and the applicant's
			// original is nowhere in the timeline it is diffed against. It no-ops
			// once any version exists, which is why passing `current.text` is right:
			// with an empty trail that IS the committed column.
			await ensureBaselineVersion(
				def.versions,
				target.id,
				typeof current.text === 'string' ? current.text : null
			);

			await recordVersion(def.versions, {
				entityId: target.id,
				content: proposed,
				source: AGENT_SOURCE,
				// Never `userRequest`: that field renders as the applicant's own
				// message in the timeline — editable, resendable — and what they asked
				// an outside agent for was not said in this thread. The same mistake
				// was made once with review turns; see application-letter-followup.ts.
				aiFeedback: written || null
			});
		},

		// Said instead of the generic "remove it again from their … page", because
		// that sentence is true of an add that landed and this one has not landed
		// on anything. An agent that reports a version as an updated letter has
		// told the applicant something false about their own application.
		appliedNote: (target, page) =>
			`Nothing on the ${def.noun} has changed yet. This is a new version waiting in ` +
			`the timeline for "${target.label}"${page ? ` (${page.path})` : ''}, where the ` +
			`applicant compares it with what is there now and keeps or deletes it. Tell them ` +
			`it is waiting and what you changed — not that their ${def.noun} has been updated.`
	};
}

export const TEXT_CAPABILITIES: Record<TextCapability, CapabilityDef> = Object.fromEntries(
	TEXT_KIND_NAMES.map((kind) => [`add_${kind}_version`, capabilityFor(kind)])
) as Record<TextCapability, CapabilityDef>;
