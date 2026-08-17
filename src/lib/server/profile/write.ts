/**
 * The one write path for a profile's sections, and the permission gate in front
 * of it.
 *
 * Three callers reach this: the form actions under `profile/(data)/*`, the REST
 * endpoints under `api/*` that the detail pages autosave through, and — from
 * Phase 1 — the assistant's capability registry, generated from the same
 * `PROFILE_RESOURCES` declaration rather than written beside it.
 *
 * They arrive with different shapes (FormData, a JSON patch, a model proposal)
 * and must land identical rows. Before this existed they did not: the form
 * actions wrote a `YYYY-MM-DD` string into the `date()` columns while the REST
 * layer wrapped the same value in `new Date()`, which the driver then
 * serialized in the server's local timezone — the stored day moved by one
 * either side of UTC depending on which door the edit came through. Nothing
 * errored. That is the failure mode a shared layer exists to remove, and the
 * reason this is worth doing before anything is generated on top of it.
 *
 * Modelled on `jobs/edit-job.ts`, which is the same idea for a job: both
 * writers meet in one function rather than one of them calling the other.
 * The difference is that jobs are bespoke enough to hand-write and profile
 * sections are not, so this is generic over a declaration.
 *
 * Nothing here knows about HTTP. Every operation returns a result its caller
 * maps onto its own vocabulary — `fail()` for a form, `error()` for a route, a
 * refusal card for a proposal — because those three disagree about what a
 * missing row should say and none of them should be teaching the others.
 */

import { dbDirect as db } from '$lib/server/db';
import { and, eq, getTableColumns, inArray, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { profiles } from '$lib/server/db/schema';
import { coerceFields } from '$lib/server/utils/field-kinds';
import { formatZodError } from '$lib/server/validation/api-schemas';
import { isProfileOnly, setProfileOnly } from '$lib/profile-visibility';
import { touchProfile } from './touch-profile';
import {
	fieldKinds,
	isHideable,
	PROFILE_RESOURCES,
	type ProfileResource,
	type ProfileResourceName,
	type SectionRow
} from './resources';

/* ------------------------------------------------------------------ *
 * Ownership
 *
 * Most sections carry `profile_id`; the rest reach it through a parent row, and
 * one — a project technology — through two. Everything below asks the
 * declaration which it is holding rather than reading a column that most tables
 * happen to have. See `ResourceOwner`.
 *
 * `ownedRows` used to refuse a chain outright, on the grounds that scoping a
 * write through two joins is a different query than the one written there. That
 * was the mistaken half: it is the same query nested once more, and recursing
 * came to fewer lines than the refusal was. What survives of the caution is
 * `MAX_OWNER_DEPTH`, which turns a declaration pointing a section at itself into
 * a loud failure rather than a hang at the bottom of every read.
 * ------------------------------------------------------------------ */

/**
 * How far a row may be from its profile.
 *
 * Three is what the declaration uses — a project technology sits under a
 * project, under a role, under the profile — and the bound is for the case the
 * declaration does not have: a cycle.
 */
const MAX_OWNER_DEPTH = 4;

/** Rows of this section the actor owns, as a condition usable in any statement. */
function ownedRows(resource: ProfileResource, actor: ProfileActor, depth = 0): SQL {
	const { owner } = resource;
	if (owner.via === 'profile') return eq(owner.column, actor.profileId);

	if (depth >= MAX_OWNER_DEPTH) {
		throw new Error(`Ownership chain deeper than ${MAX_OWNER_DEPTH} at ${owner.parent}`);
	}

	// A subquery rather than a join, so this composes into an UPDATE or a DELETE
	// the same way it composes into a SELECT — and so a chain is one more of the
	// same rather than a second shape.
	const parent = resourceFor(owner.parent);
	return inArray(
		owner.column,
		db
			.select({ id: parent.table.id })
			.from(parent.table)
			.where(ownedRows(parent, actor, depth + 1))
	);
}

/**
 * The profile a row belongs to, and — for a parent-owned row — what its parent
 * is called.
 *
 * The label comes back with the profile id because finding one costs the same
 * read as the other, and every caller that has just checked ownership is about
 * to want the parent's name: it is the value the row shows for its declared
 * `nameField`.
 */
async function ownerOf(
	resource: ProfileResource,
	row: Record<string, unknown>
): Promise<{ profileId: number | null; parentLabel?: string }> {
	const { owner } = resource;
	if (owner.via === 'profile') {
		const value = row.profile_id;
		return { profileId: value === null || value === undefined ? null : Number(value) };
	}

	const parentId = row[owner.key];
	if (parentId === null || parentId === undefined) return { profileId: null };

	const parent = resourceFor(owner.parent);
	const [parentRow] = await db
		.select()
		.from(parent.table)
		.where(eq(parent.table.id, Number(parentId)))
		.limit(1);
	if (!parentRow) return { profileId: null };

	// Labelled from the enriched row, not the raw one. A parent that is itself
	// parent-owned names ITS parent in its label — a project reads "the migration
	// — Backend Developer at Chipta" — and that name is a joined column rather
	// than one this bare select returned. Labelling the raw row would produce
	// "the migration" here and the long form in `readOwnedRows`, so a name
	// resolved against one would not match a row read through the other.
	const found = await ownerOf(parent, parentRow as Record<string, unknown>);
	return {
		profileId: found.profileId,
		parentLabel: parent.rowLabel(
			withParentName(parent, parentRow as Record<string, unknown>, found.parentLabel)
		)
	};
}

/**
 * A row as callers read it: its own columns, plus the parent's name under the
 * field the section declared for it.
 *
 * This is what makes a parent-owned section look like every other one to
 * everything downstream. The assistant's current values, the MCP read tool and
 * a proposal card all read a row by field name, and none of them should have to
 * know that one section's `category` is a join away.
 */
function withParentName(
	resource: ProfileResource,
	row: Record<string, unknown>,
	parentLabel?: string
): SectionRow {
	if (resource.owner.via !== 'parent') return row as unknown as SectionRow;
	return { ...row, [resource.owner.nameField]: parentLabel ?? null } as unknown as SectionRow;
}

/**
 * The parent row this name refers to, matched the way a person would mean it.
 *
 * Case- and space-insensitive against the parent's own `rowLabel`, scoped to
 * the actor, and it returns the parent's real label so a caller can report
 * which one it landed on. A miss is not an error here — the caller turns it
 * into a refusal that lists what does exist, which is the only refusal worth
 * reading.
 */
async function findParentNamed(
	resource: ProfileResource,
	actor: ProfileActor,
	name: string
): Promise<{ id: number; label: string } | 'none' | 'ambiguous'> {
	if (resource.owner.via !== 'parent') return 'none';

	const wanted = name.trim().toLowerCase();
	const parents = await readOwnedRows(resource.owner.parent, actor);
	const parent = resourceFor(resource.owner.parent);

	const found = parents.filter((row) => parent.rowLabel(row).trim().toLowerCase() === wanted);

	// Two groups whose labels are identical even after the version they belong to
	// has been added to them. Picking the first would be a coin toss the caller
	// cannot see the result of — the row lands under one of two headings that read
	// the same on the page — so this refuses and says so.
	if (found.length > 1) return 'ambiguous';

	return found.length === 1 ? { id: found[0].id, label: parent.rowLabel(found[0]) } : 'none';
}

/** "Backend, Frontend or Databases" — what a refusal has to say to be actionable. */
async function parentNames(resource: ProfileResource, actor: ProfileActor): Promise<string[]> {
	if (resource.owner.via !== 'parent') return [];
	const parent = resourceFor(resource.owner.parent);
	return (await readOwnedRows(resource.owner.parent, actor)).map((row) => parent.rowLabel(row));
}

/** The property a row carries its owner under: the parent's key, or `profile_id`. */
function ownerKey(resource: ProfileResource): string {
	return resource.owner.via === 'parent' ? resource.owner.key : 'profile_id';
}

/** The name field a parent-owned section carries, or null for the eight that have none. */
function parentField(resource: ProfileResource): string | null {
	return resource.owner.via === 'parent' ? resource.owner.nameField : null;
}

/** A patch with the parent's name taken out, leaving only real columns. */
function withoutParentField(
	resource: ProfileResource,
	values: Record<string, unknown>
): Record<string, unknown> {
	const field = parentField(resource);
	if (!field) return values;
	return Object.fromEntries(Object.entries(values).filter(([name]) => name !== field));
}

/**
 * Who is asking.
 *
 * A profile id, never a cookie and never a user id, because the two doors
 * disagree about what identifies a caller — the form actions resolve a
 * cookie-selected profile, the REST endpoints check `profiles.user_id` — and a
 * layer that accepted either would be authorizing by whichever one it was
 * handed. Each door converts to this first, and `actorForRow` is how the REST
 * side does it.
 */
export interface ProfileActor {
	profileId: number;
	isStaff?: boolean;
}

/** Why a write was refused, for a caller to map onto its own error shape. */
export type WriteRefusal = 'not_found' | 'unauthorized' | 'invalid';

export type WriteResult<T> =
	({ ok: true } & T) | { ok: false; reason: WriteRefusal; error: string };

/** A write whose only interesting outcome is that it happened. */
export type WriteAck = WriteResult<object>;

function refuse(
	reason: WriteRefusal,
	error: string
): { ok: false; reason: WriteRefusal; error: string } {
	return { ok: false, reason, error };
}

export function resourceFor(name: ProfileResourceName): ProfileResource {
	return PROFILE_RESOURCES[name];
}

/**
 * Resolve a signed-in user's actor for a row they claim to own.
 *
 * The REST endpoints authenticate a *user*, but everything below authorizes a
 * *profile*, and a user may own several. Rather than teach the write layer a
 * second ownership vocabulary, this translates once: find the row, follow it to
 * its profile, and hand back an actor only if that profile is the user's.
 *
 * The write call that follows re-checks ownership against the row it reads for
 * itself. That is not redundant — it is the same rule applied to a fresh read,
 * so a caller holding a stale id cannot smuggle one past the gate.
 */
export async function actorForRow(
	name: ProfileResourceName,
	id: number,
	userId: string
): Promise<ProfileActor | null> {
	const resource = resourceFor(name);

	const [row] = await db.select().from(resource.table).where(eq(resource.table.id, id)).limit(1);
	if (!row) return null;

	const { profileId } = await ownerOf(resource, row as Record<string, unknown>);
	if (profileId === null) return null;

	const owner = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profileId), eq(profiles.user_id, userId)),
		columns: { id: true }
	});
	if (!owner) return null;

	return { profileId };
}

/**
 * The actor's row, or null.
 *
 * The read half of `findOwnedRow`, for callers that want a row rather than a
 * write — a capability resolving the page's target, and anything rendering what
 * it is about to change. Collapses "missing" and "not yours" into one answer
 * because a reader has nothing to do with the difference.
 */
export async function readOwnedRow(
	name: ProfileResourceName,
	actor: ProfileActor,
	id: number
): Promise<SectionRow | null> {
	const found = await findOwnedRow(resourceFor(name), actor, id);
	return found.ok ? found.row : null;
}

/**
 * Every row of a section this actor owns, in the section's declared order.
 *
 * The read behind a list page, and behind a capability offering the assistant a
 * choice of rows. Scoped to the actor in the query rather than filtered after,
 * so a row that is not theirs is never in memory to be leaked by a later bug.
 */
export async function readOwnedRows(
	name: ProfileResourceName,
	actor: ProfileActor
): Promise<SectionRow[]> {
	const resource = resourceFor(name);

	if (resource.owner.via === 'profile') {
		const rows = await db
			.select()
			.from(resource.table)
			.where(eq(resource.owner.column, actor.profileId))
			.orderBy(...resource.orderBy);

		return rows as unknown as SectionRow[];
	}

	// Joined rather than scoped by subquery, because this read wants two things
	// the subquery cannot give it: the parent's name on every row, and an order
	// that starts with the parent's — a skills list reads by group first, and a
	// group is a column on the other table.
	const parent = resourceFor(resource.owner.parent);
	const rows = await db
		.select({
			row: getTableColumns(resource.table),
			parent: getTableColumns(parent.table)
		})
		.from(resource.table)
		.innerJoin(parent.table, eq(resource.owner.column, parent.table.id))
		.where(ownedRows(resource, actor))
		.orderBy(...resource.orderBy);

	// The join reaches the parent and stops there, which is one row short when
	// the parent is itself parent-owned: a project's own label names the role it
	// is under, and that name is not a column this select returned. So for the
	// one chained section, the labels come from reading the parent as a section —
	// the same call `findParentNamed` matches against, which is what keeps a name
	// the model is shown identical to a name it can resolve.
	const labels =
		parent.owner.via === 'parent'
			? new Map(
					(await readOwnedRows(resource.owner.parent, actor)).map((row) => [
						Number(row.id),
						parent.rowLabel(row)
					])
				)
			: null;

	return rows.map(({ row, parent: parentRow }) => {
		const parentId = Number((parentRow as Record<string, unknown>).id);
		return withParentName(
			resource,
			row as Record<string, unknown>,
			labels?.get(parentId) ?? parent.rowLabel(parentRow as unknown as SectionRow)
		);
	});
}

/**
 * How many rows of a section the actor has.
 *
 * A count rather than a read, because the one caller that wants this — the
 * manifest the assistant gets on every turn — wants only the difference between
 * "none yet" and "some", and a skills section is a hundred rows to fetch for a
 * number.
 */
export async function countOwnedRows(
	name: ProfileResourceName,
	actor: ProfileActor
): Promise<number> {
	const resource = resourceFor(name);

	const [row] = await db
		.select({ rows: sql<number>`count(*)` })
		.from(resource.table)
		.where(ownedRows(resource, actor));

	return Number(row?.rows ?? 0);
}

/** Read a row and check it belongs to the actor, in that order so the two refusals stay distinct. */
async function findOwnedRow(
	resource: ProfileResource,
	actor: ProfileActor,
	id: number
): Promise<WriteResult<{ row: SectionRow }>> {
	const [row] = await db.select().from(resource.table).where(eq(resource.table.id, id)).limit(1);

	if (!row) return refuse('not_found', `${capitalize(resource.label)} not found`);

	const owner = await ownerOf(resource, row as Record<string, unknown>);
	if (owner.profileId !== actor.profileId) {
		return refuse('unauthorized', 'Access denied');
	}

	return {
		ok: true,
		row: withParentName(resource, row as Record<string, unknown>, owner.parentLabel)
	};
}

function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Run the declared schema, then the required-field rule the schema cannot
 * express.
 *
 * The schemas mark identity fields `.optional()` so a partial patch may leave
 * them out, which means the schema alone cannot tell "not mentioned" from
 * "cleared". `mustBeComplete` is what separates them: a create needs every
 * required field, an update only needs the ones it actually mentions to be
 * non-empty.
 */
export function validatePatch(
	name: ProfileResourceName,
	input: Record<string, unknown>,
	mustBeComplete = false
): WriteResult<{ values: Record<string, unknown> }> {
	return validate(resourceFor(name), input, mustBeComplete);
}

function validate(
	resource: ProfileResource,
	input: Record<string, unknown>,
	mustBeComplete: boolean
): WriteResult<{ values: Record<string, unknown> }> {
	const parsed = resource.schema.safeParse(input);
	if (!parsed.success) {
		return refuse('invalid', formatZodError(parsed.error as z.ZodError));
	}

	const coerced = coerceFields(fieldKinds(resource), parsed.data as Record<string, unknown>);
	if (!coerced.ok) return refuse('invalid', coerced.error);

	// A declared vocabulary that nothing checks is a lie the next reader
	// believes — and the model reading it in a contract is the next reader.
	for (const [field, spec] of Object.entries(resource.fields)) {
		if (!spec.allowed || !(field in coerced.values)) continue;
		const value = coerced.values[field];
		if (value === null || spec.allowed.includes(String(value))) continue;
		return refuse('invalid', `${labelFor(field)} must be one of: ${spec.allowed.join(', ')}`);
	}

	for (const field of resource.required) {
		const mentioned = field in coerced.values;
		if (!mentioned) {
			if (mustBeComplete) return refuse('invalid', `${labelFor(field)} is required`);
			continue;
		}
		if (coerced.values[field] === null) {
			return refuse('invalid', `${labelFor(field)} is required`);
		}
	}

	return { ok: true, values: coerced.values };
}

/** Turn a column name into something worth showing a person: `author_position` → `Author position`. */
function labelFor(field: string): string {
	return capitalize(field.replace(/_/g, ' '));
}

/**
 * Substitute an empty string wherever the database refuses null.
 *
 * `absent` is what a create needs and an update must not do: a create has to
 * supply every non-nullable column, because these have no default and the
 * insert would fail on the ones the form never showed. An update supplies only
 * what it was given, so a column it did not mention keeps whatever it holds.
 */
function withoutNulls(
	resource: ProfileResource,
	values: Record<string, unknown>,
	absent: 'fill' | 'leave'
): Record<string, unknown> {
	const filled = { ...values };

	for (const column of resource.notNullColumns) {
		const mentioned = column in filled;
		if (!mentioned && absent === 'leave') continue;
		if (filled[column] === null || !mentioned) filled[column] = '';
	}

	return filled;
}

/**
 * Where a new row's `sort` goes.
 *
 * `unsorted` is not "no opinion" — it is the opinion that this list is ordered
 * by date until someone drags something, and a create must not be the thing
 * that flips it to manual.
 */
async function nextSort(
	resource: ProfileResource,
	actor: ProfileActor,
	parentId?: number
): Promise<number | null> {
	if (resource.newRowPlacement === 'unsorted') return null;

	// Within the group for a parent-owned row, not across the profile: skills are
	// ordered inside their category, and appending against a profile-wide maximum
	// would put every new skill after every skill in every other group.
	const scope =
		resource.owner.via === 'parent' && parentId !== undefined
			? eq(resource.owner.column, parentId)
			: ownedRows(resource, actor);

	const [last] = await db
		.select({ max: sql<number | null>`max(${resource.table.sort})` })
		.from(resource.table)
		.where(scope);

	return (last?.max ?? -1) + 1;
}

/** Create a row in one of the profile's sections. */
export async function createRow(
	name: ProfileResourceName,
	actor: ProfileActor,
	input: Record<string, unknown>
): Promise<WriteResult<{ id: number; row: SectionRow }>> {
	const resource = resourceFor(name);

	// Before the validation rather than after it, so a caller that pointed at the
	// parent by id satisfies the required name without having to know the label.
	// `required` holds the nameField for every parent-owned section — that is what
	// makes "a row filed nowhere" impossible — and an id is a better answer to
	// that requirement than a string the caller would have had to look up.
	const parent = await resolveParent(resource, actor, input);
	if (!parent.ok) return parent;

	const checked = validate(
		resource,
		parent.label ? { ...input, [parentField(resource) as string]: parent.label } : input,
		true
	);
	if (!checked.ok) return checked;

	const [created] = await db
		.insert(resource.table)
		.values({
			...resource.insertDefaults,
			...withoutNulls(resource, withoutParentField(resource, checked.values), 'fill'),
			[ownerKey(resource)]: parent.id ?? actor.profileId,
			sort: await nextSort(resource, actor, parent.id),
			// Written where the column exists, skipped where it doesn't — three of
			// the child collections never grew one. It decides nothing either way
			// (see HIDEABLE_RESOURCES); what it must not do is fail an insert on a
			// table that has no such column.
			...(resource.table.status ? { status: 'published' } : {}),
			date_created: new Date()
		})
		.returning();

	await touchProfile(actor.profileId);

	const row = created as unknown as SectionRow;
	return { ok: true, id: Number(row.id), row: withParentName(resource, row, parent.label) };
}

/**
 * The parent a patch points at, by id or by name, or the refusal to hand back.
 *
 * `{ id: undefined }` for a profile-owned section and for a patch that mentions
 * neither — both mean "nothing to move", which is the common case and not a
 * decision.
 *
 * ## Two ways in, because the two callers have different things to give
 *
 * The name came first and exists for the assistant: a model cannot produce a row
 * id it has never been told, and a wrong id is a write into someone else's shape
 * of the profile where a wrong name is a refusal that lists what does exist.
 *
 * A UI is the opposite. It rendered the row, so it holds the id, and making it
 * send a label instead adds a lookup that can *fail*: two roles with the same
 * title at the same employer resolve to 'ambiguous', and the projects editor
 * would refuse to add a project for a reason about neither. Given the id, the
 * ownership question is the same one — read the row as the actor, and it is
 * theirs or it is not.
 *
 * The id wins where both are present. It is the more specific of the two and the
 * one that cannot be ambiguous.
 */
async function resolveParent(
	resource: ProfileResource,
	actor: ProfileActor,
	values: Record<string, unknown>
): Promise<
	{ ok: true; id?: number; label?: string } | { ok: false; reason: WriteRefusal; error: string }
> {
	if (resource.owner.via !== 'parent') return { ok: true };
	const { key, parent: parentName } = resource.owner;

	const pointed = values[key];
	if (pointed !== null && pointed !== undefined && String(pointed).trim() !== '') {
		const id = Number(pointed);
		if (!Number.isInteger(id)) {
			return refuse('invalid', `${labelFor(key)} must be a row id.`);
		}
		const row = await readOwnedRow(parentName, actor, id);
		// Missing and not-theirs give the same answer, the way every read here
		// does: a caller who does not own a row learns nothing about whether it
		// exists.
		if (!row) return refuse('not_found', `${capitalize(resourceFor(parentName).label)} not found`);
		return { ok: true, id, label: resourceFor(parentName).rowLabel(row) };
	}

	const field = resource.owner.nameField;
	if (!(field in values)) return { ok: true };

	// Named by the parent section's own label, never "group". Six sections reach
	// their profile through a parent now and only one of them is a group of
	// skills; a project told it needs a group is being told the wrong noun about
	// the right problem.
	const parentLabel = resourceFor(resource.owner.parent).label;

	const named = values[field];
	if (named === null || String(named).trim() === '') {
		return refuse(
			'invalid',
			`A ${resource.label} has to belong to a ${parentLabel}; name the one it belongs to.`
		);
	}

	const found = await findParentNamed(resource, actor, String(named));
	if (typeof found === 'object') return { ok: true, id: found.id, label: found.label };

	if (found === 'ambiguous') {
		// Actionable, because there is something to act on: every parent label is
		// built to be distinguishing, so two identical ones mean two rows that read
		// the same on the page too.
		return refuse(
			'invalid',
			`More than one of their ${parentLabel} entries is called "${String(named)}" and nothing ` +
				`tells them apart, so this would have to guess which. They read the same on ` +
				`the page as well — giving one of them a distinguishing name or note is what ` +
				`separates them here.`
		);
	}

	const available = await parentNames(resource, actor);
	return refuse(
		'invalid',
		available.length > 0
			? `There is no ${parentLabel} called "${String(named)}". They have: ${available.join(', ')}.`
			: `There is no ${parentLabel} to file a ${resource.label} under yet — one has to be created first.`
	);
}

/**
 * Change some of a row's fields, leaving the rest alone.
 *
 * `previous` holds what the written fields contained immediately before, read
 * inside this call rather than by the caller beforehand — a caller reading it
 * first would record a before-image from before its own authorize round trip,
 * which is exactly the window in which it goes stale. Only the written fields
 * appear in it, so it pairs one-for-one with the patch and can be replayed as
 * an undo. Nothing consumes it yet; the edit log in Phase 4 is what it is for,
 * and capturing it here is what makes that phase a reader rather than a rewrite.
 */
export async function updateRow(
	name: ProfileResourceName,
	actor: ProfileActor,
	id: number,
	input: Record<string, unknown>
): Promise<WriteResult<{ previous: Record<string, unknown> }>> {
	const resource = resourceFor(name);

	const found = await findOwnedRow(resource, actor, id);
	if (!found.ok) return found;

	const checked = validate(resource, input, false);
	if (!checked.ok) return checked;

	// An empty patch is not an error, but it should not bump date_updated
	// either: a no-op save that moves the profile's clock tells the matcher and
	// the tailored-document notice that something changed when nothing did.
	const written = Object.keys(checked.values);
	if (written.length === 0) return { ok: true, previous: {} };

	const previous = Object.fromEntries(written.map((field) => [field, found.row[field] ?? null]));

	// A patch pointing at a different parent MOVES the row. Its `sort` goes to the
	// end of the group it lands in rather than travelling with it: the number
	// meant a position among its old siblings, and carried over it collides with
	// whatever already holds that position in the new group.
	//
	// Read from the raw input, not the validated values: an id is not one of the
	// section's declared fields, so the schema strips it before this would see it.
	const parent = await resolveParent(resource, actor, { ...input, ...checked.values });
	if (!parent.ok) return parent;
	const moved =
		parent.id !== undefined && parent.id !== Number(found.row[ownerKey(resource)])
			? { [ownerKey(resource)]: parent.id, sort: await nextSort(resource, actor, parent.id) }
			: {};

	await db
		.update(resource.table)
		.set({
			...withoutNulls(resource, withoutParentField(resource, checked.values), 'leave'),
			...moved,
			date_updated: new Date()
		})
		.where(eq(resource.table.id, id));

	await touchProfile(actor.profileId);

	return { ok: true, previous };
}

/**
 * Take a row off every document without destroying it.
 *
 * This is what the assistant gets instead of `deleteRow`. A proposal card is a
 * thing a person accepts in one click, and a delete is not recoverable from the
 * before-image: `previous` holds columns, and a work experience owns
 * achievements, technologies and projects across four tables that go with it.
 * An accepted mistake should cost a click to undo, not a retyping.
 *
 * ## It used to write `status`, and that did nothing
 *
 * The first version set `status` to `'draft'` on the stated grounds that
 * "exports and CVs render only `published`". They do not. `status` defaults to
 * `'draft'` on every section table, `resume/apply-diff.ts` writes `'draft'` for
 * every row it imports and never promotes them, and nothing anywhere filters a
 * section row on it — 30 of 73 work experiences and 12 of 24 languages on the
 * dev database sit at `'draft'` and print on every document. So the write
 * succeeded, the assistant reported the entry hidden, and it went on appearing
 * everywhere. A capability that lies is worse than one that refuses.
 *
 * What actually decides visibility is `tags`, through
 * `ProfileDisplay/profile-filter.ts`. `setProfileOnly` writes the `!resume` +
 * `!cv` pair that holds an item back from every base template, and it leaves
 * per-version tags alone — so an entry tagged onto one tailored version keeps
 * that tag and comes back to exactly its old state when un-hidden.
 *
 * Only the three sections in HIDEABLE_RESOURCES have that mechanism; the other
 * four are rendered unfiltered and are refused here rather than written
 * pointlessly. See the note on HIDEABLE_RESOURCES for the whole picture.
 */
export async function setRowVisible(
	name: ProfileResourceName,
	actor: ProfileActor,
	id: number,
	visible: boolean
): Promise<WriteResult<{ row: SectionRow; wasVisible: boolean }>> {
	const resource = resourceFor(name);

	// Re-checked here even though no `hide_*` capability exists for these
	// sections: `apply` is what writes, and a write path that is only correct
	// because of what its caller did is one refactor away from not being.
	if (!isHideable(name)) {
		return refuse(
			'invalid',
			`A ${resource.label} cannot be hidden — nothing filters this section on a document.`
		);
	}

	const found = await findOwnedRow(resource, actor, id);
	if (!found.ok) return found;

	const tags = (found.row.tags ?? null) as string[] | null;
	const wasVisible = !isProfileOnly(tags);

	// Already there is not an error, but it must not bump date_updated either:
	// see updateRow on why a no-op that moves the profile's clock lies to the
	// matcher and to the tailored-document notice.
	if (wasVisible === visible) return { ok: true, row: found.row, wasVisible };

	const next = setProfileOnly(tags, !visible);

	await db
		.update(resource.table)
		// Empty normalises to null, the way every other tag writer here leaves it.
		.set({ tags: next.length > 0 ? next : null, date_updated: new Date() })
		.where(eq(resource.table.id, id));

	await touchProfile(actor.profileId);

	return { ok: true, row: found.row, wasVisible };
}

/**
 * Put a row's tags back exactly as they were — the undo counterpart of
 * `setRowVisible`.
 *
 * Exact rather than derived. `setProfileOnly(tags, true)` is a *merge*, so
 * un-hiding through it lifts both base-template exclusions and would take a
 * `!resume` the applicant set by hand along with the one the assistant wrote.
 * The edit log recorded the array that was there; writing that array back is
 * the only restore that means "the way it was".
 *
 * Which also means it overwrites anything that happened since, the way every
 * undo does. The feed shows when the change was made and what it would restore,
 * and that is where the user decides.
 */
export async function setRowTags(
	name: ProfileResourceName,
	actor: ProfileActor,
	id: number,
	tags: string[] | null
): Promise<WriteAck> {
	const resource = resourceFor(name);
	if (!isHideable(name)) {
		return refuse('invalid', `A ${resource.label} carries no document tags.`);
	}

	const found = await findOwnedRow(resource, actor, id);
	if (!found.ok) return found;

	await db
		.update(resource.table)
		.set({ tags: tags && tags.length > 0 ? tags : null, date_updated: new Date() })
		.where(eq(resource.table.id, id));

	await touchProfile(actor.profileId);

	return { ok: true };
}

/**
 * Remove a row for good.
 *
 * Hard delete, and it stays reachable only from the UI — the assistant gets
 * `setRowVisible` instead, for the reason recorded there.
 */
export async function deleteRow(
	name: ProfileResourceName,
	actor: ProfileActor,
	id: number
): Promise<WriteResult<{ row: SectionRow }>> {
	const resource = resourceFor(name);

	const found = await findOwnedRow(resource, actor, id);
	if (!found.ok) return found;

	await db.delete(resource.table).where(eq(resource.table.id, id));
	await touchProfile(actor.profileId);

	return { ok: true, row: found.row };
}

/**
 * Put the section's rows in the given order.
 *
 * Ids the actor doesn't own are not an error and not a write — the update is
 * scoped to their profile, so a foreign id simply matches nothing. That was the
 * behaviour of all five reorder implementations this replaces and it is the
 * right one: a stale tab posting an order containing a since-deleted row should
 * reorder what remains, not fail.
 */
export async function reorderRows(
	name: ProfileResourceName,
	actor: ProfileActor,
	order: number[]
): Promise<WriteAck> {
	const resource = resourceFor(name);

	await Promise.all(
		order.map((id, index) =>
			db
				.update(resource.table)
				.set({ sort: index, date_updated: new Date() })
				.where(and(eq(resource.table.id, id), ownedRows(resource, actor)))
		)
	);

	await touchProfile(actor.profileId);
	return { ok: true };
}

/** Drop the manual order, so the list falls back to whatever `orderBy` says next. */
export async function resetRowOrder(
	name: ProfileResourceName,
	actor: ProfileActor
): Promise<WriteAck> {
	const resource = resourceFor(name);

	await db
		.update(resource.table)
		.set({ sort: null, date_updated: new Date() })
		.where(ownedRows(resource, actor));

	await touchProfile(actor.profileId);
	return { ok: true };
}
