/**
 * The assistant's profile capabilities, generated from `PROFILE_RESOURCES`.
 *
 * Jobs and applications are hand-written in `capabilities.ts` because their
 * semantics are bespoke — who may edit a shared job, the summariser side
 * effects, two long texts that are one editing job. Profile sections are not:
 * they are uniform CRUD over profile-owned rows, which is exactly why their
 * nine `+page.server.ts` files read like copies of each other before the write
 * layer replaced them. Generating these is the same argument one level up, and
 * it is what stops a capability becoming a *fourth* convention beside the
 * declaration, the write layer and the form actions.
 *
 * Two things the generator does that a hand-written capability would have to
 * remember:
 *
 * **Namespaced field names.** The proposal schema puts every live capability's
 * field names into one flat enum, so the model sees `summary` once no matter how
 * many sections offer one — and `summary` exists on the profile, on every work
 * experience and on every side project. The wire name is
 * `work_experience.summary`, resolved back to the column only at the point of
 * writing. That does not tell the model which row it meant, which is a separate
 * problem this does not solve; it does mean a field naming the wrong section is
 * a name that fails rather than a value that lands somewhere plausible.
 *
 * **Fields the model may not touch.** `notForAssistant` is not the same question
 * as whether a person may edit a column. It marks the ones whose wrong value is
 * *silent*: a version slug matching no version drops the item from every
 * document without erroring, and a Font Awesome name that does not exist renders
 * a gap. A person editing those sees the result immediately; a proposal card
 * shows the string and looks fine.
 *
 * **The parent, named rather than numbered.** A skill belongs to a category, so
 * its capabilities carry one extra field — `skill.category` — holding the
 * group's NAME. The write layer resolves it against the actor's own categories,
 * which is where the ownership check on the parent lives; what this file adds is
 * that the groups are listed in the prompt and checked against that list before
 * a proposal is stored. A name that matches nothing is then a refusal that says
 * which groups exist, at the point the model can still do something about it,
 * rather than an exception thrown at apply time.
 */

import {
	assistantFields,
	HIDEABLE_RESOURCES,
	PROFILE_RESOURCE_NAMES,
	PROFILE_RESOURCES,
	type FieldSpec,
	type HideableResourceName,
	type ProfileResource,
	type ProfileResourceName,
	type SectionRow
} from '$lib/server/profile/resources';
import {
	createRow,
	readOwnedRow,
	readOwnedRows,
	setRowTags,
	setRowVisible,
	updateRow,
	validatePatch
} from '$lib/server/profile/write';
import type { CapabilityActor, CapabilityDef, CapabilityTarget } from './capabilities';
import type { ContextEntity } from './generation-context';

/**
 * The three verbs, and why deletion is not one of them.
 *
 * `edit` and `add` are ordinary. Removal is not: nothing a capability writes is
 * recoverable from the before-image, and a work experience owns achievements,
 * technologies and projects across four tables that a delete takes with it. So
 * the assistant proposes `hide` — the `!resume` + `!cv` tag pair, which takes
 * an entry off every document while leaving the row and its children alone. It
 * is one click to accept and one to undo, on the same page the applicant would
 * have edited it from. Hard delete stays UI-only.
 *
 * `hide` was originally `status: 'draft'`, on the belief that documents render
 * only `published` rows. They do not; nothing filters on that column at all.
 * See HIDEABLE_RESOURCES, which also records why only three of the seven
 * sections have this verb.
 */
export type ProfileCapability =
	`edit_${ProfileResourceName}` | `add_${ProfileResourceName}` | `hide_${HideableResourceName}`;

export const PROFILE_VERBS = ['edit', 'add', 'hide'] as const;

/**
 * Every verb this section actually has.
 *
 * `hide` is not universal: four of the seven sections are rendered on documents
 * with no filter between them and the page, so there is nothing to write that
 * would take an entry off one. See HIDEABLE_RESOURCES. Offering the verb anyway
 * is how the first version of this shipped a write that changed nothing while
 * the assistant reported the entry hidden.
 */
export function verbsFor(resource: ProfileResourceName): ProfileCapability[] {
	const verbs: ProfileCapability[] = [
		`edit_${resource}` as ProfileCapability,
		`add_${resource}` as ProfileCapability
	];
	if ((HIDEABLE_RESOURCES as readonly string[]).includes(resource)) {
		verbs.push(`hide_${resource as HideableResourceName}`);
	}
	return verbs;
}

export const PROFILE_CAPABILITY_NAMES = PROFILE_RESOURCE_NAMES.flatMap(verbsFor);

/** The section a generated capability acts on. */
export function resourceForCapability(capability: ProfileCapability): ProfileResourceName {
	return capability.slice(capability.indexOf('_') + 1) as ProfileResourceName;
}

/**
 * The wire name for a column: the section, then the column.
 *
 * A dot rather than an underscore so the boundary survives a column name that
 * already has underscores in it — `work_experience_start_date` is ambiguous
 * about where the section ends, and every date column here would hit that.
 */
function wireName(resource: ProfileResourceName, column: string): string {
	return `${resource}.${column}`;
}

/** The column a wire name refers to, or null when it names another section's. */
function columnName(resource: ProfileResourceName, field: string): string | null {
	const prefix = `${resource}.`;
	return field.startsWith(prefix) ? field.slice(prefix.length) : null;
}

/**
 * The columns a recorded before-image refers to, accepting either spelling.
 *
 * Not a relaxation of the rule above — that one is for model output, where a
 * field naming another section has to fail rather than land somewhere
 * plausible. This is for `previous` off a history row, and there are two
 * writers of those: a capability records what was proposed, so its keys are
 * namespaced, and `write.ts` records the columns it wrote. Both are the same
 * change and both undo through here.
 *
 * The strict version applied to a column-named before-image resolves every key
 * to null, filters the patch to empty, and `updateRow` reports success at having
 * written nothing — so the history marked the change undone and the value
 * stayed. That is the shape of failure this whole layer exists to remove, and it
 * is why this is a separate function rather than a flag: the two callers want
 * genuinely different answers to a name with no prefix.
 */
function toColumnsFromRecord(
	resource: ProfileResourceName,
	allowed: Record<string, FieldSpec>,
	fields: Record<string, unknown>
): Record<string, unknown> {
	const prefix = `${resource}.`;
	return Object.fromEntries(
		Object.entries(fields)
			.map(
				([field, value]) =>
					[field.startsWith(prefix) ? field.slice(prefix.length) : field, value] as const
			)
			.filter(([column]) => column in allowed)
	);
}

/**
 * Turn a namespaced patch back into column names, keeping only this section's
 * columns and only the ones the assistant may write.
 *
 * The allow-list is repeated here rather than trusted from upstream on purpose.
 * `pickCapabilityFields` already drops anything outside `fields` before
 * `executeCapability` calls `apply`, so in the real flow this is the second
 * check — but `apply` is what actually writes, and a write path that is only
 * safe because of what its caller did is one refactor away from not being. The
 * columns this drops are the ones whose wrong value is silent.
 */
function toColumns(
	resource: ProfileResourceName,
	allowed: Record<string, FieldSpec>,
	fields: Record<string, unknown>
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(fields)
			.map(([field, value]) => [columnName(resource, field), value] as const)
			.filter(
				(entry): entry is readonly [string, unknown] => entry[0] !== null && entry[0] in allowed
			)
	);
}

/** The wire name of the field naming this section's parent, or null. */
function parentWireField(resource: ProfileResource, name: ProfileResourceName): string | null {
	return resource.owner.via === 'parent' ? wireName(name, resource.owner.nameField) : null;
}

/**
 * The parent rows this section can be filed under, as names.
 *
 * Carried in `current` beside the values, which is what lets `validate` — which
 * is synchronous and has no database — refuse a group that does not exist. It
 * is read fresh on every turn and again inside `executeCapability`, so the list
 * a proposal is checked against is never the one it was written against.
 */
async function parentLabels(
	resource: ProfileResource,
	actor: CapabilityActor,
	entity?: ContextEntity | null
): Promise<string[] | undefined> {
	if (resource.owner.via !== 'parent') return undefined;
	const parent = PROFILE_RESOURCES[resource.owner.parent];
	// Narrowed to the row the page is about, like the target list is. A page
	// about one role offering "file it under any of your eight jobs" is inviting
	// the wrong one, and it is also the single most expensive block on that page
	// — every role's projects, printed to answer a question about this role.
	const rows = await rowsFor(resource.owner.parent, entity ?? null, actor);
	return rows.map((row) => parent.rowLabel(row));
}

/** "One of Backend, Frontend or Databases" — the check and the message it produces. */
function checkParent(
	resource: ProfileResource,
	name: ProfileResourceName,
	proposed: Record<string, unknown>,
	current: Record<string, unknown>
): { ok: true } | { ok: false; error: string } {
	const field = parentWireField(resource, name);
	if (!field || !(field in proposed)) return { ok: true };

	const groups = Array.isArray(current.parents) ? (current.parents as string[]) : null;
	// No list to check against is not a pass by omission: `apply` re-resolves the
	// name and refuses there too. It is a pass by *deferral*, and the only way to
	// reach it is a caller that did not read `current` first.
	if (!groups) return { ok: true };

	const wanted = String(proposed[field] ?? '')
		.trim()
		.toLowerCase();
	if (groups.some((group) => group.trim().toLowerCase() === wanted)) return { ok: true };

	const parent = PROFILE_RESOURCES[(resource.owner as { parent: ProfileResourceName }).parent];
	return {
		ok: false,
		error:
			groups.length > 0
				? `There is no ${parent.label} called "${String(proposed[field])}". They have: ${groups.join(', ')}.`
				: `They have no ${parent.title.toLowerCase()} yet, so there is nowhere to file a ${resource.label}. Propose adding one first.`
	};
}

/**
 * Refuse an add of an entry the model was just shown it already has.
 *
 * ## Why prose was not enough
 *
 * The add contract already ends with the inventory and "do not propose a
 * duplicate of anything already in one". That instruction lost an argument it
 * should have won: asked to revise a project it had proposed one turn earlier
 * and the user had accepted, the assistant proposed adding it again — with the
 * duplicate name sitting first in that very list, and first in the edit verb's
 * target list a few hundred characters above it. Two copies of one project,
 * differing only in wording, on every document.
 *
 * The cause is fixed elsewhere (a turn's proposals now come back with their
 * outcome, so "you already added that" is a fact in the transcript rather than
 * something to infer from a list). This is the floor under it: the same rule
 * the contract states, enforced where a refusal is possible instead of asked
 * for where it can only be obeyed.
 *
 * ## Where the comparison comes from
 *
 * The labels — the exact strings the model was shown — rather than a column
 * chosen per section. Sections name themselves differently (`name` here,
 * `description` there, `area` and `institution` joined), and `rowLabel` is
 * already the one place that knows which; comparing anything else would be a
 * second answer to a question the declaration has settled. It also keeps the
 * check honest about what it is: not "is this the same entry" — nothing here
 * can know that — but "did you propose a duplicate of a line in the list",
 * which is what was asked of the model in words.
 *
 * ## Two entries sharing a truncated label are not a duplicate
 *
 * `short()` cuts a label at 60 characters, so an achievement's label is the
 * head of its description and two unrelated achievements can open identically.
 * A truncated label is a prefix, and a prefix match is not an identity, so a
 * refusal is only issued when neither side was cut. That leaves the long-text
 * sections unguarded here, which is the correct amount of guarding available
 * from the data this has — and they are also the sections where a genuine
 * second entry is most likely.
 *
 * Nothing is refused when there is no inventory to check against, the same way
 * `checkParent` passes when it has no list: both are deferrals, not exemptions.
 */
function checkDuplicate(
	resource: ProfileResource,
	name: ProfileResourceName,
	allowed: Record<string, FieldSpec>,
	proposed: Record<string, unknown>,
	current: Record<string, unknown>
): { ok: true } | { ok: false; error: string } {
	const grouped = current.existingByGroup as Record<string, string[]> | undefined;
	const flat = Array.isArray(current.existing) ? (current.existing as string[]) : null;
	if (!grouped && !flat) return { ok: true };

	// The row this proposal would produce, labelled by whichever function built
	// the list it is being compared against — the grouped inventory prints short
	// labels, because a row's group is already the line it sits on.
	const row = toColumns(name, allowed, proposed) as unknown as SectionRow;
	const label = grouped ? (resource.shortLabel ?? resource.rowLabel)(row) : resource.rowLabel(row);
	if (label.trim() === '' || label.endsWith('…')) return { ok: true };

	const parentField = parentWireField(resource, name);
	const group = grouped
		? Object.keys(grouped).find(
				(key) =>
					key.trim().toLowerCase() ===
					String(proposed[parentField ?? ''] ?? '')
						.trim()
						.toLowerCase()
			)
		: null;
	const existing = grouped ? (group ? (grouped[group] ?? []) : []) : (flat ?? []);

	const match = existing.find(
		(entry) => !entry.endsWith('…') && entry.trim().toLowerCase() === label.trim().toLowerCase()
	);
	if (!match) return { ok: true };

	// Addressed to both readers this reaches. It is shown to the user, under the
	// reply that promised them the change (see renderDropNotice), and it is
	// stored with that reply — so it is also what the model reads next turn,
	// where "correct that one" is the move it has a capability for.
	//
	// No full stop at the end: `renderDropNotice` adds one. Every other refusal
	// in this layer is written the same way, bar `checkParent`, which is where
	// the stray ".." in the drop notice comes from.
	return {
		ok: false,
		error:
			`"${match}" is already ${group ? `a ${resource.label} under ${group}` : `in their ${resource.title.toLowerCase()}`}. ` +
			`Propose a correction to that one instead of adding a second copy — ` +
			`if it really is a separate entry, it can be added from the page itself`
	};
}

/** One line of the contract's field list. */
function describeField(name: string, spec: FieldSpec): string {
	const parts: string[] = [];
	if (spec.note) parts.push(spec.note);
	if (spec.allowed) parts.push(`one of: ${spec.allowed.join(', ')}`);
	if (spec.kind === 'date') parts.push('YYYY-MM-DD');
	if (spec.kind === 'int') parts.push('a whole number, no separators');

	return parts.length > 0 ? `- "${name}" — ${parts.join('. ')}.` : `- "${name}"`;
}

/**
 * The prose contract for a section.
 *
 * Prose and not just a schema, for the reason recorded on `CapabilityDef`:
 * passing a schema is not enough with either provider, and spelling the contract
 * out in words is what makes structured output hold. What is generated here is
 * the part that varies — which fields exist and what each holds. Rules that are
 * true of every capability live once in `renderCapabilityPrompt`'s preamble.
 */
function contractFor(resource: ProfileResource, name: ProfileResourceName): string {
	const fields = assistantFields(resource);
	const lines = Object.entries(fields).map(([column, spec]) =>
		describeField(wireName(name, column), spec)
	);

	const withheld = Object.entries(resource.fields).filter(([, spec]) => spec.notForAssistant);

	return `You may propose corrections to this ${resource.label}.

Every field name here begins with "${name}." — that prefix says which part of the
profile the field belongs to, and several parts have a field with the same short
name. Use the full name exactly as written:

${lines.join('\n')}

Each field is replaced outright, so send the complete new value, not a fragment
or a diff. A field you do not list keeps what it holds; a field with a null value
is cleared.${
		withheld.length > 0
			? `

You cannot change ${withheld.map(([column]) => `"${column}"`).join(' or ')} here. If the user asks you to,
say so plainly and tell them where in the profile to do it themselves — do not
work around it by writing the value into another field.`
			: ''
	}

Do not invent history. Tightening how something is worded is in scope; adding a
responsibility, a date or an employer the applicant has not told you about is
not.`;
}

/**
 * What the model sees of a row's current values.
 *
 * Long texts are shown as a length rather than in full, the same way the job
 * long-text capability does it and for the same reason: the texts themselves
 * already reach the model through the `profile` context source, which is built
 * from the profile and its work experiences. Printing them again here would
 * spend the budget twice to say the same thing, next to a profile blob that is
 * already the largest block in the prompt.
 */
const INLINE_LIMIT = 160;

/**
 * `parents` rides along in `current` without being a field, so it is rendered
 * as what it is — the groups this row could be filed under — rather than as a
 * value someone could propose a new version of.
 */
const NOT_A_VALUE = new Set(['parents']);

function renderState(current: Record<string, unknown>): string {
	const lines = Object.entries(current)
		.filter(([field]) => !NOT_A_VALUE.has(field))
		.map(([field, value]) => {
			if (value === null || value === undefined || value === '') return `  - ${field}: (not set)`;
			if (Array.isArray(value)) return `  - ${field}: ${value.join(', ')}`;

			const text = String(value);
			return text.length > INLINE_LIMIT
				? `  - ${field}: ${text.length} characters, shown in full in their profile above`
				: `  - ${field}: ${text}`;
		});

	const groups = Array.isArray(current.parents) ? (current.parents as string[]) : null;

	return [
		`Current values:\n\n${lines.join('\n')}`,
		groups
			? `\n\nWhat it can be filed under, named exactly as written:\n\n${groups
					.map((group) => `  - ${group}`)
					.join('\n')}`
			: ''
	]
		.join('')
		.trimEnd();
}

/**
 * The sections between this one and the profile, nearest first.
 *
 * A role's projects are one away, a project's technologies two. Both are
 * "part of" the role whose page the user is on, and that is the relation the
 * two functions below need: which rows a page is about, and whether a verb
 * belongs on it at all.
 */
function ancestorsOf(name: ProfileResourceName): ProfileResourceName[] {
	const { owner } = PROFILE_RESOURCES[name];
	return owner.via === 'parent' ? [owner.parent, ...ancestorsOf(owner.parent)] : [];
}

/**
 * The ids of this section's rows that are, or descend from, the row the page is
 * about — or null when the page is about something else entirely.
 *
 * Walks down from the entity rather than up from each row, so it costs one read
 * per level rather than one per row, and so the answer for a grandchild is the
 * intersection of two levels rather than a special case.
 */
async function idsUnder(
	name: ProfileResourceName,
	entity: { resource: ProfileResourceName; id: number },
	actor: CapabilityActor
): Promise<Set<number> | null> {
	if (name === entity.resource) return new Set([entity.id]);

	const { owner } = PROFILE_RESOURCES[name];
	if (owner.via !== 'parent') return null;

	const above = await idsUnder(owner.parent, entity, actor);
	if (!above) return null;

	const rows = await readOwnedRows(name, { profileId: actor.profileId });
	return new Set(
		rows.filter((row) => above.has(Number(row[owner.key]))).map((row) => Number(row.id))
	);
}

/**
 * Every row of this section the model may name here.
 *
 * On a page about one role, that is that role's projects — not every project on
 * the profile. Without this the list on /profile/work-experience/8 would be the
 * projects of all twelve roles, which is both the wrong offer (the user is
 * looking at one job) and, at a line each, most of what the page's capability
 * budget buys.
 *
 * A page about nothing in particular, or about an unrelated section, falls
 * through to the whole list — which is the behaviour every section had before
 * there were children.
 */
async function rowsFor(
	name: ProfileResourceName,
	entity: ContextEntity | null,
	actor: CapabilityActor
): Promise<SectionRow[]> {
	const rows = await readOwnedRows(name, { profileId: actor.profileId });
	if (entity?.type !== 'profile_section') return rows;

	const allowed = await idsUnder(name, entity, actor);
	return allowed ? rows.filter((row) => allowed.has(Number(row.id))) : rows;
}

/** Read the row this capability is about, or null if it is gone or not theirs. */
async function target(
	name: ProfileResourceName,
	id: number,
	actor: CapabilityActor
): Promise<{ row: SectionRow; target: CapabilityTarget } | null> {
	const row = await readOwnedRow(name, { profileId: actor.profileId }, id);
	if (!row) return null;
	return { row, target: targetFor(name, row) };
}

/**
 * A row as a capability target: its label, and — where the label says more than
 * the row does — the row's own name for the matcher to narrow on.
 */
function targetFor(name: ProfileResourceName, row: SectionRow): CapabilityTarget {
	const resource = PROFILE_RESOURCES[name];
	return {
		id: row.id,
		label: resource.rowLabel(row),
		...(resource.shortLabel ? { match: resource.shortLabel(row) } : {})
	};
}

function editCapability(name: ProfileResourceName): CapabilityDef {
	const resource = PROFILE_RESOURCES[name];
	const fields = assistantFields(resource);

	return {
		title: `Correct this ${resource.label}`,

		/**
		 * The row the page is about. Nothing else resolves: a section page shows
		 * one row, and a capability for a different section on the same page has
		 * no target and drops out of the turn.
		 */
		resolve: async (entity, actor) => {
			if (entity?.type !== 'profile_section' || entity.resource !== name) return null;
			return (await target(name, entity.id, actor))?.target ?? null;
		},

		/**
		 * Every row of this section, for a page that is about the list rather than
		 * one entry — the languages page, not one language. Tried only when
		 * `resolve` came back empty, so a detail page still keeps its own row and
		 * the model is never offered a choice it did not need.
		 */
		resolveMany: async (entity, actor) => {
			const rows = await rowsFor(name, entity, actor);
			return rows.map((row) => targetFor(name, row));
		},

		/**
		 * Asked again against a fresh read, never against the resolved target.
		 * A proposal can sit in a resumable thread for twelve hours, and a row
		 * can be deleted or a profile switched inside that window.
		 */
		authorize: async (t, actor) =>
			(await readOwnedRow(name, { profileId: actor.profileId }, t.id)) !== null,

		/**
		 * Read against the actor, not by id alone. A job is readable by anyone
		 * signed in, so the hand-written capabilities can look one up bare; a
		 * profile row read that way would put another applicant's history into
		 * this one's prompt.
		 */
		current: async (t, actor, entity) => {
			const row = await readOwnedRow(name, { profileId: actor.profileId }, t.id);
			const groups = await parentLabels(resource, actor, entity);
			return {
				...Object.fromEntries(
					Object.keys(fields).map((column) => [wireName(name, column), row?.[column] ?? null])
				),
				...(groups ? { parents: groups } : {})
			};
		},

		fields: Object.fromEntries(
			Object.entries(fields).map(([column, spec]) => [wireName(name, column), spec.kind])
		),

		contract: contractFor(resource, name),

		renderState,

		validate: (proposed, current) => {
			const group = checkParent(resource, name, proposed, current);
			if (!group.ok) return group;

			const checked = validatePatch(name, toColumns(name, fields, proposed));
			return checked.ok ? { ok: true } : { ok: false, error: checked.error };
		},

		/**
		 * Write the old values back. Same path as the edit itself, so ownership,
		 * coercion and validation are all re-asked — a log row records what
		 * happened, it does not authorize anything.
		 */
		revert: async (t, previous, actor) => {
			const patch = toColumnsFromRecord(name, fields, previous);
			// An empty patch is a before-image this capability cannot read, not a
			// change with nothing in it: `updateRow` would write nothing and report
			// success, and the history would mark the change undone.
			if (Object.keys(patch).length === 0) {
				throw new Error(`edit_${name} recorded no fields this can put back`);
			}

			const result = await updateRow(name, { profileId: actor.profileId }, t.id, patch);
			if (!result.ok) {
				throw new Error(`edit_${name} could not be undone: ${result.error}`);
			}
		},

		apply: async (t, proposed, _current, actor) => {
			const result = await updateRow(
				name,
				{ profileId: actor.profileId },
				t.id,
				toColumns(name, fields, proposed)
			);

			// authorize and validate both passed moments ago, so a refusal here is
			// a race — the row deleted, the profile switched — not a bad proposal.
			if (!result.ok) {
				throw new Error(`edit_${name} refused at write time: ${result.error}`);
			}
		}
	};
}

/**
 * Add an entry to a section.
 *
 * The target is the PROFILE, not a row — there is no row yet. That is the same
 * shape `add_activity_record` uses for the same reason, and it is why an add is
 * live on a section's list page and on one entry's page alike: "add another
 * role" means the same thing from both.
 *
 * `current` is what the section already holds rather than a diff, so the model
 * can tell "they have told me something new" from "that is already the third
 * item on this list". Adding a language they already have is the failure this
 * exists to prevent.
 */
function addCapability(name: ProfileResourceName): CapabilityDef {
	const resource = PROFILE_RESOURCES[name];
	const fields = assistantFields(resource);

	return {
		title: `Add a ${resource.label}`,

		// The profile itself, on any page of this section — or of a section this
		// one hangs off, since a role's page is where its projects are added.
		// Nothing to resolve from the URL: an add has no row to name.
		resolve: async (entity, actor) =>
			entity?.type === 'profile_section' &&
			entity.resource !== name &&
			!ancestorsOf(name).includes(entity.resource)
				? null
				: { id: actor.profileId, label: `their ${resource.title.toLowerCase()}` },

		authorize: async (t, actor) => t.id === actor.profileId,

		current: async (_t, actor, entity) => {
			const rows = await rowsFor(name, entity ?? null, actor);
			const groups = await parentLabels(resource, actor, entity);
			if (!groups) return { existing: rows.map((row) => resource.rowLabel(row)) };

			// By group, the way the page shows them. A flat list would repeat the
			// group on every line — a skill's label carries it — which on a profile
			// with a hundred skills is most of this block spent on the word
			// "Backend". Measured at 2,800 characters flat against 1,200 grouped.
			const inventory: Record<string, string[]> = Object.fromEntries(
				groups.map((group) => [group, []])
			);
			for (const row of rows) {
				const group = String(row[(resource.owner as { nameField: string }).nameField] ?? '');
				(inventory[group] ??= []).push((resource.shortLabel ?? resource.rowLabel)(row));
			}

			return { existingByGroup: inventory, parents: groups };
		},

		fields: Object.fromEntries(
			Object.entries(fields).map(([column, spec]) => [wireName(name, column), spec.kind])
		),

		contract: `${contractFor(resource, name)}

This one ADDS a new ${resource.label} rather than changing an existing one, so
every field you send is the new entry's own. ${
			resource.required.length > 0
				? `You must give ${resource.required
						.map((column) => `"${wireName(name, column)}"`)
						.join(
							' and '
						)} — without ${resource.required.length > 1 ? 'them' : 'it'} there is nothing to show in the list, and the proposal is discarded.`
				: ''
		}

Check what they already have, listed below, before proposing one. Adding a
second copy of something already there is worse than not adding it: it is a
duplicate on every document, and they have to find and remove it.`,

		renderState: (current) => {
			const groups = Array.isArray(current.parents) ? (current.parents as string[]) : null;

			// A parent-owned section prints its inventory by parent, which is both
			// what the page looks like and where a new entry has to go — so the two
			// things the model needs are one list rather than two.
			if (groups) {
				// The parent's own noun, never "group". A project filed under a role
				// is not in a group of anything, and six sections have a parent now
				// where only skills did when this said otherwise.
				const parent =
					PROFILE_RESOURCES[(resource.owner as { parent: ProfileResourceName }).parent];

				if (groups.length === 0) {
					return (
						`They have no ${parent.label} to file one under yet, so there is nothing you ` +
						`can add here until one exists. Propose adding a ${parent.label} first.`
					);
				}

				const inventory = (current.existingByGroup ?? {}) as Record<string, string[]>;
				const lines = groups.map(
					(group) =>
						`  - ${group}: ${inventory[group]?.length ? inventory[group].join(', ') : '(empty)'}`
				);

				// No plural of the parent's label anywhere here: `label` is singular and
				// naive pluralisation produces "skill categorys". The list that
				// follows says what these are, and each field's own note names the
				// parent in words the declaration chose.
				return `File it under one of these, named exactly as written, and do not propose
a duplicate of anything already in one:\n\n${lines.join('\n')}`;
			}

			const existing = Array.isArray(current.existing) ? (current.existing as string[]) : [];
			if (existing.length === 0) return `They have no ${resource.title.toLowerCase()} yet.`;

			return `Already there — do not propose a duplicate of any of these:\n\n${existing
				.map((label) => `  - ${label}`)
				.join('\n')}`;
		},

		// A create, so every required field must be present rather than merely
		// non-empty where mentioned.
		validate: (proposed, current) => {
			const group = checkParent(resource, name, proposed, current);
			if (!group.ok) return group;

			const checked = validatePatch(name, toColumns(name, fields, proposed), true);
			if (!checked.ok) return { ok: false, error: checked.error };

			// Last, because a duplicate of a row that does not have a valid name yet
			// is not the interesting thing wrong with it — and because this reads
			// the label the proposal would produce, which is only meaningful once
			// the fields behind it have been checked.
			//
			// Runs in both places `validate` runs, and the second is not redundant:
			// two turns can each propose the same addition while neither has been
			// accepted, and it is the Apply button on the second card — not the
			// model — that would then make the duplicate.
			return checkDuplicate(resource, name, fields, proposed, current);
		},

		apply: async (_t, proposed, _current, actor) => {
			const result = await createRow(
				name,
				{ profileId: actor.profileId },
				toColumns(name, fields, proposed)
			);
			if (!result.ok) {
				throw new Error(`add_${name} refused at write time: ${result.error}`);
			}

			// The row, so the change is recorded against the thing that appeared
			// rather than against the profile this was addressed to — and so a
			// thread can name it next turn instead of proposing it a second time.
			return targetFor(name, result.row);
		}
	};
}

/**
 * Take an entry off every document, reversibly.
 *
 * No fields: naming the row is the whole of the proposal. That is why
 * `executeCapability` only refuses an empty payload for a capability that asked
 * for values — this one asked for none and is complete without them.
 *
 * `current` returns the row in full even though nothing is being written to it,
 * because that is what the card has to show. A hide card that said only
 * "Spanish" would be asking someone to accept the removal of something they
 * cannot see; the person deciding needs to read what goes.
 */
function hideCapability(name: HideableResourceName): CapabilityDef {
	const resource = PROFILE_RESOURCES[name];
	const editor = editCapability(name);

	return {
		title: `Hide this ${resource.label}`,

		// Same targeting as the edit verb: the page's row where there is one, and
		// otherwise every row for the model to name.
		resolve: editor.resolve,
		resolveMany: editor.resolveMany,
		authorize: editor.authorize,
		current: editor.current,

		fields: {},

		contract: `You may propose hiding one of their ${resource.title.toLowerCase()}.

Hiding takes it off every CV and every export. It is NOT deleted — they can put
it back from their ${resource.page.name} page — but it stops appearing
everywhere until they do, so propose it only when they have asked for it rather
than because it looks weak to you. A ${resource.label} they are not proud of is
still theirs to decide about.${resource.hideNote ? `\n\n${resource.hideNote}` : ''}

This proposal carries no fields. Name the entry and say why in the rationale;
there is nothing to write.`,

		renderState: (current) => {
			const shown = Object.entries(current)
				.filter(([field]) => !NOT_A_VALUE.has(field))
				.filter(([, value]) => value !== null && value !== undefined && value !== '')
				.map(([field, value]) => `  - ${field}: ${String(value).slice(0, INLINE_LIMIT)}`);
			return shown.length > 0 ? `What hiding this would take off:\n\n${shown.join('\n')}` : '';
		},

		validate: () => ({ ok: true }),

		/**
		 * The row's document tags, which is what hiding rewrites.
		 *
		 * The default before-image is the old values of the fields being written,
		 * and this capability writes no fields — so without this the log would
		 * record `{}` and an undo would have nothing to put back. Recording the
		 * whole array rather than "it was visible" is what lets the undo restore a
		 * per-version tag the applicant set by hand alongside it.
		 */
		beforeImage: async (t, _current, actor) => {
			const row = await readOwnedRow(name, { profileId: actor.profileId }, t.id);
			return { tags: (row?.tags as string[] | null) ?? null };
		},

		revert: async (t, previous, actor) => {
			const tags = Array.isArray(previous.tags) ? (previous.tags as string[]) : null;
			const result = await setRowTags(name, { profileId: actor.profileId }, t.id, tags);
			if (!result.ok) {
				throw new Error(`hide_${name} could not be undone: ${result.error}`);
			}
		},

		apply: async (t, _proposed, _current, actor) => {
			const result = await setRowVisible(name, { profileId: actor.profileId }, t.id, false);
			if (!result.ok) {
				throw new Error(`hide_${name} refused at write time: ${result.error}`);
			}
		}
	};
}

export const PROFILE_CAPABILITIES = Object.fromEntries([
	...PROFILE_RESOURCE_NAMES.flatMap((name) => [
		[`edit_${name}`, editCapability(name)],
		[`add_${name}`, addCapability(name)]
	]),
	...HIDEABLE_RESOURCES.map((name) => [`hide_${name}`, hideCapability(name)])
]) as Record<ProfileCapability, CapabilityDef>;
