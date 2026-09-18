/**
 * Starting a text that does not exist yet.
 *
 * The companion to `text-version-capabilities.ts`, which for one release said
 * in its own doc comment that creation was deliberately out of reach. That was
 * true of the mechanism it described and it stopped being true here, so the
 * sentence moved rather than being quietly falsified: a version verb still
 * cannot bring a text into existence, and these verbs do nothing else.
 *
 * ## What a create is allowed to decide, which is what names the row and no more
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
 * ## Which kinds, and the two shapes they arrive in
 *
 * `TEXT_CREATE_KIND_NAMES` carries the policy. Briefly: a story and a cheat
 * sheet are the applicant's own prep, a letter is a document started under an
 * application they already have, and a question stays out because its label is
 * what an employer asked and minting one asserts that they asked it.
 *
 * The letter is the one that made this file read a declaration rather than
 * assume a profile. Everything a create needs differs with what owns the row —
 * what it targets, what it authorizes against, which list it checks for a
 * duplicate — and what it decides differs too: two kinds take a title they
 * invent, one takes a type from a fixed pair. Both live in `TextCreateDef`
 * beside the columns they describe, so this file branches twice rather than
 * carrying a letter-shaped exception in five places.
 *
 * ## Tier, and why this is not a request
 *
 * `tiers.ts` grades by what a write replaces, and this replaces nothing: an
 * empty row on a page that lists them, removable in one click. Tier 1, the same
 * answer it gives every `add_`. The burst ceiling still applies, so an agent in
 * a loop fills a review queue rather than the applicant's pages.
 */

import { readProfileApplication } from '$lib/server/applications/profile-applications';
import {
	TEXT_CREATE_KIND_NAMES,
	TEXT_KINDS,
	type CreatableTextKind,
	type TextCreateDef
} from '$lib/server/texts/profile-texts';
import type { CapabilityDef, CapabilityTarget } from './capabilities';

/** How many existing rows the model is shown, so it makes no second copy. */
const EXISTING_SHOWN = 40;

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

/** The wire name this kind's one decision goes by, from the def declaring it. */
export function textCreateFieldName(kind: CreatableTextKind): string {
	return TEXT_KINDS[kind].create.field;
}

/** Whether an agent may start one of these without naming an application. */
export function textCreateOwner(kind: CreatableTextKind): TextCreateDef['owner'] {
	return TEXT_KINDS[kind].create.owner;
}

/**
 * The value to write, as `validate` accepts it, or null for one it refuses.
 *
 * Shared by the two, so the check and the write cannot disagree about what a
 * value means. A choice is matched case-insensitively and stored as the def
 * spells it: a model that sends "Cover_Letter" meant the type that exists, and
 * storing its capitalisation would make a letter the list has no label for.
 */
function normalize(create: TextCreateDef, raw: unknown): string | null {
	const value = typeof raw === 'string' ? raw.trim() : '';
	if (!value) return null;
	if (create.decides !== 'choice') return value;
	return create.choices.find((choice) => choice.value === value.toLowerCase())?.value ?? null;
}

/**
 * What the list will call the row these values make.
 *
 * The name wins where a choice carries one, which is the rule `letterLabel`
 * applies when the row is read back. The two have to agree: this is what the
 * duplicate check compares, so a label computed differently here would refuse a
 * name the list would have shown as distinct, or allow one it would not.
 */
function labelFor(create: TextCreateDef, value: string, name?: string | null): string {
	const named = name?.trim();
	if (named) return named;
	if (create.decides !== 'choice') return value;
	return create.choices.find((choice) => choice.value === value)?.label ?? value;
}

/** The optional name a choice may carry, or undefined for one that may not. */
function namedFieldOf(create: TextCreateDef): { field: string; maxLength: number } | undefined {
	return create.decides === 'choice' ? create.named : undefined;
}

/**
 * The name a call sent, trimmed, and empty for one that sent none.
 *
 * Shared by `validate` and `apply` so they cannot disagree about whether a
 * whitespace-only name counts: it does not, anywhere. A row named " " would be
 * a row the list has a blank label for, which is worse than the unnamed one it
 * was trying to tell apart.
 */
function nameSent(fields: Record<string, unknown>, field: string): string {
	const raw = fields[field];
	return typeof raw === 'string' ? raw.trim() : '';
}

function contractFor(kind: CreatableTextKind): string {
	const def = TEXT_KINDS[kind];
	const create = def.create;
	const { noun, collection } = def;

	const decides =
		create.decides === 'title'
			? `- "${create.field}" is what it will be called in the applicant's list and is REQUIRED.
  A short name for the subject, not a sentence and not the text itself: "Freelance
  vs. permanent", "Chipta scaling story". At most ${create.maxLength} characters.`
			: `- "${create.field}" is which kind of ${noun} to start and is REQUIRED. One of:
${create.choices.map((choice) => `  ${choice.value} — listed as "${choice.label}"`).join('\n')}`;

	const named = namedFieldOf(create);
	const naming = named
		? `\n- "${named.field}" is optional, and is what the list calls it INSTEAD of the
  type. Send one when there is already a ${noun} of that type: without a name the
  second row reads exactly like the first, and that is the one thing this refuses.
  A short name for what it is for, at most ${named.maxLength} characters.`
		: '';

	const owner =
		create.owner === 'application'
			? `\nIt is started UNDER an application the applicant already has, named by
"application_id" from list_applications. This does not create the application:
if the role is not there at all, add_application first.\n`
			: '';

	const somewhere =
		create.owner === 'application'
			? `an empty ${noun} on an application is a row on their ${collection.name} page`
			: `an empty ${noun} with a title nobody asked for is a row on their ${collection.name} page`;

	const already = named
		? `Check what that application already has, listed below, before adding. A second
${noun} reading the same in that list is not a proposal they can decline.`
		: create.owner === 'application'
			? `Check what that application already has, listed below, before adding. A second
${noun} of the same type is not a proposal they can decline.`
			: `Check what they already have, listed below, before adding. A second ${noun} on a
subject already covered is not a proposal they can decline.`;

	const instead = named
		? `Add to the existing one instead, with add_${kind}_version, or give this one a
name that says what it is for.`
		: `Add to the existing one instead, with add_${kind}_version.`;

	return `Start a new ${noun}, empty.

${decides}${naming}

**It is created empty.** This call decides ${create.decides === 'choice' ? (named ? 'the type and the name' : 'the type') : 'the title'} and nothing else. There
is no field here for the ${noun}'s text, and that is the point. Write the ${noun}
itself with add_${kind}_version afterwards, using the id this returns, and the
applicant takes that version from the timeline the way they take every other
one. Do not report the ${noun} as written until you have made that second call.
${owner}
Create one when the applicant has asked for a ${noun} they named. Not to have
somewhere to put something you thought of: ${somewhere} that they
have to read, understand and delete.

${already} It is a duplicate they have to
find. ${instead}`;
}

function capabilityFor(kind: CreatableTextKind): CapabilityDef {
	const def = TEXT_KINDS[kind];
	const create = def.create;
	const field = create.field;
	const owned = create.owner === 'application' ? 'on this application' : 'on this profile';
	const named = namedFieldOf(create);

	return {
		title: `Start a new ${def.noun}`,

		// A profile-owned create takes the profile, never the row on the page,
		// mirroring add_application and for its reason: a page about one text is
		// not where "start another" is being asked, and it is the tightest prompt
		// budget on the site. An application-owned one takes the application the
		// page is about, which is the row add_activity_record files under.
		//
		// No route scope grants any of these today, so in practice only MCP
		// resolves them — for a letter through `entities.ts`, which reads the id
		// off the call, and for the other two through the null branch here.
		resolve: async (entity, actor) => {
			if (create.owner === 'profile') {
				return entity ? null : { id: actor.profileId, label: `their ${def.collection.name}` };
			}
			if (entity?.type !== 'application') return null;
			const application = await readProfileApplication(entity.id, actor.profileId);
			return application ? { id: application.id, label: applicationName(application) } : null;
		},

		authorize: async (target, actor) =>
			create.owner === 'profile'
				? target.id === actor.profileId
				: !!(await readProfileApplication(target.id, actor.profileId)),

		// Not a diff: there is no row yet. What the model needs is what it might
		// duplicate, which is the question every `add_` asks. Scoped to the
		// application for the kind that hangs off one — every letter on the profile
		// would answer a question nobody asked, and half of them are on
		// applications this call cannot touch.
		current: async (target, actor) => {
			const existing = await def.list(actor.profileId, {
				...(create.owner === 'application' ? { applicationId: target.id } : {}),
				limit: EXISTING_SHOWN
			});
			return { existing: existing.map((row) => row.label) };
		},

		// The name is a second field and never a second required one: a first
		// letter of a type is named by the type, and the contract asks for a name
		// only where one would otherwise arrive unreadable.
		fields: named ? { [field]: 'string', [named.field]: 'string' } : { [field]: 'string' },
		requiredFields: [field],

		contract: contractFor(kind),

		renderState: (state) => {
			const existing = (state.existing as string[] | undefined) ?? [];
			return existing.length > 0
				? `Already ${owned}. Do not start a second one of these:\n\n` +
						`${existing.map((line) => `  - ${line}`).join('\n')}`
				: `There are no ${def.noun}s ${owned} yet.`;
		},

		validate: (fields, state) => {
			const raw = fields[field];
			const sent = typeof raw === 'string' ? raw.trim() : '';

			if (!sent) {
				return {
					ok: false,
					error:
						create.decides === 'choice'
							? `A ${def.noun} needs a type. "${field}" is required, and is one of: ` +
								`${create.choices.map((choice) => choice.value).join(', ')}.`
							: `A ${def.noun} needs a title. "${field}" is required.`
				};
			}

			if (create.decides === 'title' && sent.length > create.maxLength) {
				return {
					ok: false,
					error:
						`That title is ${sent.length} characters and the column holds ` +
						`${create.maxLength}. It names the ${def.noun} in a list; the content goes ` +
						`in a version, not in here.`
				};
			}

			const value = normalize(create, sent);
			if (!value) {
				// Only reachable for a choice: a title normalizes to itself.
				return {
					ok: false,
					error:
						`"${sent}" is not a ${def.noun} type. "${field}" is one of: ` +
						`${create.decides === 'choice' ? create.choices.map((c) => c.value).join(', ') : ''}.`
				};
			}

			const name = named ? nameSent(fields, named.field) : '';
			if (named && name.length > named.maxLength) {
				return {
					ok: false,
					error:
						`That name is ${name.length} characters and the column holds ` +
						`${named.maxLength}. It names the ${def.noun} in a list; the content goes ` +
						`in a version, not in here.`
				};
			}

			// The same guard add_application carries, for the same reason: a
			// duplicate is not a card they decline, it is one they have to hunt down.
			// What it compares is the LABEL, so a named kind is refused only where
			// the list would read the same twice, and naming the second one is the
			// way past it rather than a reason to write on top of the first.
			const label = labelFor(create, value, name);
			const existing = Array.isArray(state.existing) ? (state.existing as string[]) : [];
			const clash = existing.find(
				(entry) => String(entry).trim().toLowerCase() === label.toLowerCase()
			);
			if (clash) {
				return {
					ok: false,
					error: named
						? `There is already a ${def.noun} called "${clash}" ${owned}. Send a ` +
							`"${named.field}" saying what this one is for, or write a new version of ` +
							`that one with add_${kind}_version.`
						: `There is already a ${def.noun} called "${clash}" ${owned}. Write a ` +
							`new version of that one with add_${kind}_version rather than starting a second.`
				};
			}

			return { ok: true };
		},

		apply: async (target, fields): Promise<CapabilityTarget> => {
			const value = normalize(create, fields[field]);
			if (!value) {
				// Unreachable: `validate` runs first on both paths that reach here and
				// refuses everything this rejects. Thrown rather than guessed, because
				// a create that picked a value for itself would put a row the applicant
				// never asked for on their page.
				throw new Error(`add_${kind} reached apply with no usable ${field}`);
			}

			// The target is the profile or the application: `authorize` checked it
			// against the actor, so this is the row the new one belongs under.
			const created = await create.insert(
				target.id,
				value,
				named ? nameSent(fields, named.field) || null : null
			);

			// The row it made, not what it was added to. The target names the owner,
			// which is what to authorize against and the wrong thing to call the
			// change.
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

/**
 * An application named the way the approval card names it.
 *
 * Spelled out here rather than imported from `capabilities.ts`: that module
 * imports this one, and a text capability has never reached back into it for
 * anything but types. Same shape as `applicationLabel`, which is the one this
 * file cannot have.
 */
function applicationName(application: {
	job_title: string | null;
	job_company: string | null;
}): string {
	return [application.job_title ?? 'Application', application.job_company]
		.filter(Boolean)
		.join(' at ');
}

export const TEXT_CREATE_CAPABILITIES: Record<TextCreateCapability, CapabilityDef> =
	Object.fromEntries(
		TEXT_CREATE_KIND_NAMES.map((kind) => [`add_${kind}`, capabilityFor(kind)])
	) as Record<TextCreateCapability, CapabilityDef>;
