/**
 * Starting an interview-prep text that does not exist yet.
 *
 * The companion to `text-version-capabilities.ts`, which for one release said
 * in its own doc comment that creation was deliberately out of reach. That was
 * true of the mechanism it described and it stopped being true here, so the
 * sentence moved rather than being quietly falsified: a version verb still
 * cannot bring a text into existence, and these two verbs do nothing else.
 *
 * ## What a create is allowed to decide, which is the title and nothing more
 *
 * The property the version verbs are built on is that a text changes only when
 * a person takes a version from its timeline. A create that accepted content
 * would walk straight around it: on a new row the content IS the text, there
 * is no version and no diff, so a whole document would land on the profile
 * having been read by nobody. So these make an EMPTY row, and the words arrive
 * afterwards through `add_<kind>_version` like everyone else's do.
 *
 * That is also why the pair is two calls rather than one convenient one. The
 * seam between them is the approval.
 *
 * ## Why only two of the four kinds
 *
 * `TEXT_CREATE_KIND_NAMES` carries the reasoning. Briefly: a story and a cheat
 * sheet are the applicant's own prep, owned by the profile and deleted with a
 * click. A letter and a question are claims about an employer, and an agent
 * that can mint a question can put words in a company's mouth.
 *
 * ## Tier, and why this is not a request
 *
 * `tiers.ts` grades by what a write replaces, and this replaces nothing: an
 * empty titled row on a page that lists them, removable in one click. Tier 1,
 * the same answer it gives every `add_`. The burst ceiling still applies, so an
 * agent in a loop fills a review queue rather than the interview-prep page.
 */

import {
	TEXT_CREATE_KIND_NAMES,
	TEXT_KINDS,
	type CreatableTextKind
} from '$lib/server/texts/profile-texts';
import type { CapabilityDef, CapabilityTarget } from './capabilities';

/** Longest title the column holds. Refused here so the insert cannot throw. */
const TITLE_MAX = 255;

/** How many existing titles the model is shown, so it makes no second copy. */
const TITLES_SHOWN = 40;

export type TextCreateCapability = `add_${CreatableTextKind}`;

export const TEXT_CREATE_CAPABILITY_NAMES = TEXT_CREATE_KIND_NAMES.map(
	(kind) => `add_${kind}` as TextCreateCapability
);

/** The kind a capability creates, from its name. */
export function kindForTextCreateCapability(capability: TextCreateCapability): CreatableTextKind {
	return capability.slice('add_'.length) as CreatableTextKind;
}

export function isTextCreateCapability(name: string): name is TextCreateCapability {
	return (TEXT_CREATE_CAPABILITY_NAMES as string[]).includes(name);
}

/** The wire name this kind's title goes by. Prefixed, as every field here is. */
export function textTitleFieldName(kind: CreatableTextKind): string {
	return `${kind}_title`;
}

function contractFor(kind: CreatableTextKind): string {
	const { noun, collection } = TEXT_KINDS[kind];
	const title = textTitleFieldName(kind);

	return `Start a new ${noun}, empty, under a title.

- "${title}" is what it will be called in the applicant's list and is REQUIRED.
  A short name for the subject, not a sentence and not the text itself: "Freelance
  vs. permanent", "Chipta scaling story". At most ${TITLE_MAX} characters.

**It is created empty.** This call decides the title and nothing else. There is
no field here for the ${noun}'s text, and that is the point. Write the ${noun}
itself with add_${kind}_version afterwards, using the id this returns, and the
applicant takes that version from the timeline the way they take every other
one. Do not report the ${noun} as written until you have made that second call.

Create one when the applicant has asked for a ${noun} on a subject they named.
Not to have somewhere to put something you thought of: an empty ${noun} with a
title nobody asked for is a row on their ${collection.name} page that they have
to read, understand and delete.

Check what they already have, listed below, before adding. A second ${noun} on a
subject already covered is not a proposal they can decline. It is a duplicate
they have to find. Add to the existing one instead, with add_${kind}_version.`;
}

function capabilityFor(kind: CreatableTextKind): CapabilityDef {
	const def = TEXT_KINDS[kind];
	const title = textTitleFieldName(kind);

	return {
		title: `Start a new ${def.noun}`,

		// The profile, never the row on the page, mirroring add_application, and
		// for its reason: a page about one text is not where "start another" is
		// being asked, and it is the tightest prompt budget on the site. No route
		// scope grants these today, so in practice only MCP resolves them, which
		// passes null here.
		resolve: async (entity, actor) =>
			entity ? null : { id: actor.profileId, label: `their ${def.collection.name}` },

		authorize: async (target, actor) => target.id === actor.profileId,

		// Not a diff: there is no row yet. What the model needs is what it might
		// duplicate, which is the question every `add_` asks.
		current: async (_target, actor) => {
			const existing = await def.list(actor.profileId, { limit: TITLES_SHOWN });
			return { existing: existing.map((row) => row.label) };
		},

		fields: { [title]: 'string' },
		requiredFields: [title],

		contract: contractFor(kind),

		renderState: (state) => {
			const existing = (state.existing as string[] | undefined) ?? [];
			return existing.length > 0
				? `Already on this profile. Do not start a second one on any of these ` +
						`subjects:\n\n${existing.map((line) => `  - ${line}`).join('\n')}`
				: `There are no ${def.noun}s on this profile yet.`;
		},

		validate: (fields, state) => {
			const raw = fields[title];
			const proposed = typeof raw === 'string' ? raw.trim() : '';

			if (!proposed) {
				return { ok: false, error: `A ${def.noun} needs a title. "${title}" is required.` };
			}
			if (proposed.length > TITLE_MAX) {
				return {
					ok: false,
					error:
						`That title is ${proposed.length} characters and the column holds ` +
						`${TITLE_MAX}. It names the ${def.noun} in a list; the content goes in a ` +
						`version, not in here.`
				};
			}

			// The same guard add_application carries, for the same reason: a
			// duplicate is not a card they decline, it is one they have to hunt down.
			const existing = Array.isArray(state.existing) ? (state.existing as string[]) : [];
			const clash = existing.find(
				(entry) => String(entry).trim().toLowerCase() === proposed.toLowerCase()
			);
			if (clash) {
				return {
					ok: false,
					error:
						`There is already a ${def.noun} called "${clash}" on this profile. Write a ` +
						`new version of that one with add_${kind}_version rather than starting a second.`
				};
			}

			return { ok: true };
		},

		apply: async (target, fields): Promise<CapabilityTarget> => {
			// `create` is optional on the def because two of the four kinds have
			// none. This capability is only built for a kind in
			// TEXT_CREATE_KIND_NAMES, and a name listed there whose def lacks a
			// `create` fails a test rather than reaching here.
			if (!def.create) {
				throw new Error(`${def.kind} has no create, so add_${kind} should not exist`);
			}

			// The target is the profile: authorize checked it against the actor, so
			// this is the id the row belongs to.
			const created = await def.create(target.id, String(fields[title]).trim());

			// The row it made, not the profile it was added to. The target names the
			// profile, which is what to authorize against and the wrong thing to call
			// the change.
			return { id: created.id, label: created.label };
		},

		// The generic "remove it again from their … page" is true here, but it is
		// not the thing the agent has to be told: it has made an empty row and its
		// own job is half done.
		appliedNote: (target, page) =>
			`"${target.label}" exists now and is EMPTY. Write its text with ` +
			`add_${kind}_version using id ${target.id}, which puts a version in its ` +
			`timeline for the applicant to take` +
			`${page ? `, and remove it again from ${page.path} if it was not wanted` : ''}.`
	};
}

export const TEXT_CREATE_CAPABILITIES: Record<TextCreateCapability, CapabilityDef> =
	Object.fromEntries(
		TEXT_CREATE_KIND_NAMES.map((kind) => [`add_${kind}`, capabilityFor(kind)])
	) as Record<TextCreateCapability, CapabilityDef>;
