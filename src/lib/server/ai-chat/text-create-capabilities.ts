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
 * ## Which kinds, and the three shapes they arrive in
 *
 * `TEXT_CREATE_KIND_NAMES` carries the policy. Briefly: a story and a cheat
 * sheet are the applicant's own prep, a letter is a document started under an
 * application they already have, and a question is what an employer asked on
 * one, which an agent may copy onto it and never write.
 *
 * The letter is the one that made this file read a declaration rather than
 * assume a profile. Everything a create needs differs with what owns the row —
 * what it targets, what it authorizes against, which list it checks for a
 * duplicate — and what it decides differs too: two kinds take a title they
 * invent, one takes a type from a fixed pair, and one takes a question it
 * copies. All of that lives in `TextCreateDef` beside the columns it
 * describes, so this file branches on the declaration rather than carrying a
 * letter-shaped exception in five places.
 *
 * The question's line is held by its contract, which is the same place every
 * other "only what the applicant told you" is held: the field is the question
 * as the employer worded it, and the contract says to copy it and nothing
 * else. What the code adds is a duplicate check that compares the whole
 * question, because the list's label is cut at a hundred characters.
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
	shorten,
	type CreatableTextKind,
	type TextCreateDef
} from '$lib/server/texts/profile-texts';
import { countVersions } from './entity-versions';
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
 * What a create of this kind starts, and what its text is called.
 *
 * The same word for three kinds: a letter's text is the letter. A question's
 * is its answer, so `row` is the question the create makes and `text` is the
 * answer the version verb writes under it, and `separate` says which case the
 * prose is in. Read once here so no sentence has to know which kind it is in.
 */
function nounsOf(kind: CreatableTextKind): { row: string; text: string; separate: boolean } {
	const def = TEXT_KINDS[kind];
	const row = def.create.noun ?? def.noun;
	return { row, text: def.noun, separate: row !== def.noun };
}

/**
 * Whether two labels would read as the same row.
 *
 * Case and runs of whitespace do not make two of them different: "Freelance vs.
 * permanent" twice is one subject however it was typed, and a question copied
 * from a form arrives with whatever line breaks the form had.
 */
function sameLabel(a: string, b: string): boolean {
	const flat = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();
	return flat(a) === flat(b);
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
 *
 * A question is the exception, and on purpose: it comes back whole, where the
 * list cuts it to a line, because `current` hands the duplicate check whole
 * questions to compare it with.
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
	const { collection } = def;
	const { row: noun, text, separate } = nounsOf(kind);

	// The prompt shape is the one whose field is not the agent's to compose, so
	// its paragraph is where "copy it, never write it" is said.
	const decides =
		create.decides === 'title'
			? `- "${create.field}" is what it will be called in the applicant's list and is REQUIRED.
  A short name for the subject, not a sentence and not the text itself: "Freelance
  vs. permanent", "Chipta scaling story". At most ${create.maxLength} characters.`
			: create.decides === 'prompt'
				? `- "${create.field}" is the ${noun} exactly as the employer asked it, and is REQUIRED.
  Copy it word for word from where it came: a form, an email or a message the
  applicant gave you, or the posting itself (read_job). Do not write one, and do
  not reword, shorten, merge or translate one: this row says the employer asked
  it, and the ${text} will be judged against its words. One ${noun} per call, so a
  form with five is five calls. At most ${create.maxLength} characters.`
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
		: create.decides === 'prompt'
			? `Check what that application already has, listed below, before adding. The same
${noun} twice is not a proposal they can decline.`
			: create.owner === 'application'
				? `Check what that application already has, listed below, before adding. A second
${noun} of the same type is not a proposal they can decline.`
				: `Check what they already have, listed below, before adding. A second ${noun} on a
subject already covered is not a proposal they can decline.`;

	const instead = named
		? `Add to the existing one instead, with add_${kind}_version, or give this one a
name that says what it is for.`
		: separate
			? `Write the ${text} on the existing one instead, with add_${kind}_version.`
			: `Add to the existing one instead, with add_${kind}_version.`;

	const decided =
		create.decides === 'choice'
			? named
				? 'the type and the name'
				: 'the type'
			: create.decides === 'prompt'
				? `the ${noun}`
				: 'the title';

	// Where the row and its text are one thing the version verb writes the row
	// itself; a question's version verb writes the answer under it, and saying
	// "write the question with add_question_version" would send the agent to
	// rewrite what the employer asked.
	const empty = separate
		? `**It is created empty.** This call decides ${decided} and nothing else. There
is no field here for the ${text}, and that is the point. Write the ${text} with
add_${kind}_version afterwards, using the id this returns, and the applicant
takes that version from the timeline the way they take every other one. Do not
report the ${text} as written until you have made that second call.`
		: `**It is created empty.** This call decides ${decided} and nothing else. There
is no field here for the ${noun}'s text, and that is the point. Write the ${noun}
itself with add_${kind}_version afterwards, using the id this returns, and the
applicant takes that version from the timeline the way they take every other
one. Do not report the ${noun} as written until you have made that second call.`;

	// A question is not the applicant's to ask for: the employer asked it or it
	// is not one. The question an agent is most likely to invent is the one it
	// expects in an interview, so the contract names where that one goes.
	const when =
		create.decides === 'prompt'
			? `Create one for a ${noun} the employer actually asked. Not for one you expect
them to be asked: practising for an interview is prep, and it goes in a cheat
sheet or a story (add_cheat_sheet, add_story), not on the application as
something the company said.`
			: `Create one when the applicant has asked for a ${noun} they named. Not to have
somewhere to put something you thought of: ${somewhere} that they
have to read, understand and delete.`;

	return `${separate ? `Start a new ${noun}, with no ${text} yet.` : `Start a new ${noun}, empty.`}

${decides}${naming}

${empty}
${owner}
${when}

${already} It is a duplicate they have to
find. ${instead}`;
}

function capabilityFor(kind: CreatableTextKind): CapabilityDef {
	const def = TEXT_KINDS[kind];
	const create = def.create;
	const field = create.field;
	const owned = create.owner === 'application' ? 'on this application' : 'on this profile';
	const named = namedFieldOf(create);
	const nouns = nounsOf(kind);
	const noun = nouns.row;

	return {
		title: `Start a new ${noun}`,

		// A profile-owned create takes the profile, never the row on the page,
		// mirroring add_application and for its reason: a page about one text is
		// not where "start another" is being asked, and it is the tightest prompt
		// budget on the site. An application-owned one takes the application the
		// page is about, which is the row add_activity_record files under.
		//
		// No route scope grants any of these today, so in practice only MCP
		// resolves them — for a letter or a question through `entities.ts`, which
		// reads the id off the call, and for the other two through the null
		// branch here.
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

		/**
		 * The undo names the text, where the proposal named what it hangs off.
		 *
		 * Kept apart from `authorize` rather than folded into it, and here that
		 * separation is load-bearing rather than tidy: `apply` passes the target's
		 * id to `create.insert` as the OWNER. An `authorize` that also accepted a
		 * text id would accept a proposal naming a letter and file the new letter
		 * under it.
		 *
		 * `read` is scoped to the actor's profile, so this is the same ownership
		 * question asked of the row instead of its owner.
		 */
		authorizeRevert: async (target, actor) => (await def.read(target.id, actor.profileId)) !== null,

		// Not a diff: there is no row yet. What the model needs is what it might
		// duplicate, which is the question every `add_` asks. Scoped to the
		// application for the kind that hangs off one — every letter on the profile
		// would answer a question nobody asked, and half of them are on
		// applications this call cannot touch.
		//
		// A question is listed whole rather than by its label. The list cuts a
		// question at a hundred characters, so two that open the same way would
		// collide on the cut, and a long one sent again would never match its own
		// shortened label.
		current: async (target, actor) => {
			const existing = await def.list(actor.profileId, {
				...(create.owner === 'application' ? { applicationId: target.id } : {}),
				limit: EXISTING_SHOWN
			});
			return {
				existing: existing.map((row) =>
					create.decides === 'prompt' ? (row.prompt ?? row.label) : row.label
				)
			};
		},

		// The name is a second field and never a second required one: a first
		// letter of a type is named by the type, and the contract asks for a name
		// only where one would otherwise arrive unreadable.
		fields: named ? { [field]: 'string', [named.field]: 'string' } : { [field]: 'string' },
		requiredFields: [field],

		contract: contractFor(kind),

		renderState: (state) => {
			const existing = (state.existing as string[] | undefined) ?? [];
			// One line per row whatever it holds: a question copied from a form keeps
			// the form's line breaks, and the second line of one would read as a row.
			return existing.length > 0
				? `Already ${owned}. Do not start a second one of these:\n\n` +
						`${existing.map((line) => `  - ${line.replace(/\s+/g, ' ').trim()}`).join('\n')}`
				: `There are no ${noun}s ${owned} yet.`;
		},

		validate: (fields, state) => {
			const raw = fields[field];
			const sent = typeof raw === 'string' ? raw.trim() : '';

			if (!sent) {
				return {
					ok: false,
					error:
						create.decides === 'choice'
							? `A ${noun} needs a type. "${field}" is required, and is one of: ` +
								`${create.choices.map((choice) => choice.value).join(', ')}.`
							: create.decides === 'prompt'
								? `A ${noun} needs its wording. "${field}" is required: the ${noun} ` +
									`exactly as the employer asked it.`
								: `A ${noun} needs a title. "${field}" is required.`
				};
			}

			if (create.decides === 'title' && sent.length > create.maxLength) {
				return {
					ok: false,
					error:
						`That title is ${sent.length} characters and the column holds ` +
						`${create.maxLength}. It names the ${noun} in a list; the content goes ` +
						`in a version, not in here.`
				};
			}

			// Not a column's limit, since the column has none: a bound on what one
			// question is, so the call it refuses is one that holds more than one.
			if (create.decides === 'prompt' && sent.length > create.maxLength) {
				return {
					ok: false,
					error:
						`That is ${sent.length} characters, and one ${noun} runs to at most ` +
						`${create.maxLength} here. Send one ${noun} per call, as it was asked. If ` +
						`this holds the ${nouns.text} as well, that goes in add_${kind}_version once ` +
						`the ${noun} exists.`
				};
			}

			const value = normalize(create, sent);
			if (!value) {
				// Only reachable for a choice: a title or a question normalizes to itself.
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
			//
			// For a question it compares the whole question on both sides (see
			// `current`), and the refusal quotes the one it ran into cut to a line:
			// the agent has the rest of it in the call it just made.
			const label = labelFor(create, value, name);
			const existing = Array.isArray(state.existing) ? (state.existing as string[]) : [];
			const clash = existing.find((entry) => sameLabel(String(entry), label));
			if (clash) {
				return {
					ok: false,
					error: named
						? `There is already a ${noun} called "${clash}" ${owned}. Send a ` +
							`"${named.field}" saying what this one is for, or write a new version of ` +
							`that one with add_${kind}_version.`
						: create.decides === 'prompt'
							? `That ${noun} is already ${owned}: "${shorten(clash)}". Write the ` +
								`${nouns.text} on it with add_${kind}_version rather than starting a second.`
							: `There is already a ${noun} called "${clash}" ${owned}. Write a ` +
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
			//
			// `path` travels with it because the row knows it and nothing
			// downstream can rebuild it: a letter's page is under the application it
			// belongs to. The changes feed links the entry to it — without this an
			// agent's new text is the one row in the history you cannot click.
			return { id: created.id, label: created.label, path: created.path };
		},

		/**
		 * Delete the row this add made, while it is still the empty row it made.
		 *
		 * What this verb creates is a shell: a title or a type and no text, which
		 * the agent is told to fill with `add_${kind}_version` next. The half-done
		 * state is the common one, and until now the only way out of it was to
		 * find the row on its own page.
		 *
		 * Two refusals, and both are "somebody has put something here since":
		 *
		 *  - **Text on it.** Committed through `setText`, by the applicant or by a
		 *    version they accepted. The row is no longer the empty one this made.
		 *  - **Versions under it.** A version is a row in a timeline that the
		 *    applicant has not ruled on yet, and it is the thing `add_${kind}_version`
		 *    leaves them to decide. Deleting the text would decide it for them by
		 *    taking the timeline with it.
		 *
		 * The target is the created row here rather than the owner it was
		 * addressed to, the same swap every add makes once the log holds it — so
		 * `read` is asked for the row, not for what it hangs off.
		 */
		revert: async (t, _previous, actor) => {
			const row = await def.read(t.id, actor.profileId);
			if (!row) return;

			const where = `Delete it from your ${def.collection.name} page instead.`;

			if (row.committed && row.committed.trim()) {
				throw new Error(
					`This ${noun} has text on it now${nouns.separate ? ` (its ${nouns.text})` : ''}, ` +
						`and undoing the add would delete that text with it. ${where}`
				);
			}

			if ((await countVersions(def.versions, t.id)) > 0) {
				throw new Error(
					`This ${noun} has a version waiting in its timeline, which undoing ` +
						`the add would delete unread. Decide on that version first, or ` +
						`delete the ${noun} from your ${def.collection.name} page.`
				);
			}

			// The owner the delete is scoped by, which is not the same column per
			// kind: a letter belongs to an application, a story and a cheat sheet
			// to the profile. A letter whose application is missing is a row this
			// cannot scope a statement to, so it refuses rather than widening one.
			const owner = create.owner === 'application' ? row.applicationId : actor.profileId;
			if (owner === null || owner === undefined) {
				throw new Error(`add_${kind} could not be undone: that ${noun} names no application`);
			}

			await create.remove(t.id, owner);
		},

		// The generic "remove it again from their … page" is true here, but it is
		// not the thing the agent has to be told: it has made an empty row and its
		// own job is half done. A question is not empty to look at, since it
		// carries the employer's words, so the note says what it lacks instead.
		appliedNote: (target, page) =>
			`"${target.label}" exists now and ` +
			`${nouns.separate ? `has no ${nouns.text} yet` : 'is EMPTY'}. ` +
			`Write its ${nouns.separate ? nouns.text : 'text'} with ` +
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
