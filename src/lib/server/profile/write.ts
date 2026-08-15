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
import { and, eq, sql } from 'drizzle-orm';
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

	const [row] = await db
		.select({ profile_id: resource.table.profile_id })
		.from(resource.table)
		.where(eq(resource.table.id, id))
		.limit(1);
	if (!row) return null;

	const profileId = Number(row.profile_id);
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

	const rows = await db
		.select()
		.from(resource.table)
		.where(eq(resource.table.profile_id, actor.profileId))
		.orderBy(...resource.orderBy);

	return rows as unknown as SectionRow[];
}

/** Read a row and check it belongs to the actor, in that order so the two refusals stay distinct. */
async function findOwnedRow(
	resource: ProfileResource,
	actor: ProfileActor,
	id: number
): Promise<WriteResult<{ row: SectionRow }>> {
	const [row] = await db.select().from(resource.table).where(eq(resource.table.id, id)).limit(1);

	if (!row) return refuse('not_found', `${capitalize(resource.label)} not found`);

	const found = row as unknown as SectionRow;
	if (Number(found.profile_id) !== actor.profileId) {
		return refuse('unauthorized', 'Access denied');
	}

	return { ok: true, row: found };
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
async function nextSort(resource: ProfileResource, profileId: number): Promise<number | null> {
	if (resource.newRowPlacement === 'unsorted') return null;

	const [last] = await db
		.select({ max: sql<number | null>`max(${resource.table.sort})` })
		.from(resource.table)
		.where(eq(resource.table.profile_id, profileId));

	return (last?.max ?? -1) + 1;
}

/** Create a row in one of the profile's sections. */
export async function createRow(
	name: ProfileResourceName,
	actor: ProfileActor,
	input: Record<string, unknown>
): Promise<WriteResult<{ id: number; row: SectionRow }>> {
	const resource = resourceFor(name);

	const checked = validate(resource, input, true);
	if (!checked.ok) return checked;

	const [created] = await db
		.insert(resource.table)
		.values({
			...resource.insertDefaults,
			...withoutNulls(resource, checked.values, 'fill'),
			profile_id: actor.profileId,
			sort: await nextSort(resource, actor.profileId),
			status: 'published',
			date_created: new Date()
		})
		.returning();

	await touchProfile(actor.profileId);

	const row = created as unknown as SectionRow;
	return { ok: true, id: Number(row.id), row };
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

	await db
		.update(resource.table)
		.set({ ...withoutNulls(resource, checked.values, 'leave'), date_updated: new Date() })
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
				.where(and(eq(resource.table.id, id), eq(resource.table.profile_id, actor.profileId)))
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
		.where(eq(resource.table.profile_id, actor.profileId));

	await touchProfile(actor.profileId);
	return { ok: true };
}
