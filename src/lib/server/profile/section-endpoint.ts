/**
 * One REST surface for every profile section, parameterised by the section.
 *
 * ## Why this exists
 *
 * `resources.ts` is the declaration and `write.ts` is the one write path over
 * it; this is the one HTTP door in front of that, and it exists for the same
 * reason both of those do. Before it there were three hand-written endpoints —
 * work-experience, education, side-project — each pairing a `updateRow` call for
 * the row's own fields with bespoke merge logic for the collections hanging off
 * it, and a fourth convention (`reorder-endpoint.ts`) for reordering three other
 * sections. Fifteen sections, four doors, and no way for a new one to be
 * reachable without a new file.
 *
 * ## Why a per-row door and not another collection merge
 *
 * The three existing endpoints take a whole collection and reconcile it: delete
 * every row not in the payload, update the rest by id, insert the remainder.
 * That is the right shape for a form with a Save button, and the wrong shape for
 * anything that saves as you type — every keystroke would ship a full snapshot
 * of the section from one tab's memory, so a second tab, or a stale one, deletes
 * whatever it never knew about. The auto-save helper says the same thing about
 * record-shaped fields (see `diffPayload`); a collection is that failure one
 * level up, where the lost thing is a row rather than a field.
 *
 * One row per request has no such window. It is also what `createRow` and
 * `updateRow` already are, so this file is routing and ownership and nothing
 * else.
 *
 * ## Where the actor comes from
 *
 * Three answers, because the three verbs have different things to go on:
 *
 *  - **PATCH and DELETE** name a row, so `requireRowActor` follows it to its
 *    profile — through one parent, or two, whatever the declaration says.
 *  - **POST** has no row yet. A parent-owned section is created under a parent,
 *    and that parent IS a row, so the same check works on it. This is also why
 *    the parent is given by id here rather than by the label the assistant uses:
 *    a UI rendered the row and holds its id, and a label can be ambiguous where
 *    an id cannot. See `resolveParent`.
 *  - **POST to a profile-owned section, and reorder** have neither, so the body
 *    names the profile and it is checked against the signed-in user — the same
 *    check `reorder-endpoint.ts` has always made.
 */

import { error, json, type RequestEvent } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { dbDirect as db } from '$lib/server/db';
import { profiles } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { formatZodError } from '$lib/server/validation/api-schemas';
import { PROFILE_RESOURCES, type ProfileResourceName } from './resources';
import { createRow, deleteRow, type ProfileActor, readOwnedRow, reorderRows } from './write';
import { patchOwnedRow, requireRowActor, unwrapWrite } from './write-http';

/**
 * The section named in the URL, or 404.
 *
 * A path segment is user input, and `PROFILE_RESOURCES[segment]` on an unchecked
 * one is `undefined` reaching the write layer as a resource — which throws
 * somewhere far from here about a property of undefined. 404 is the honest
 * answer: there is no such section.
 */
export function requireResource(param: string | undefined): ProfileResourceName {
	if (!param || !(param in PROFILE_RESOURCES)) {
		error(404, `No such profile section: ${param ?? '(none)'}`);
	}
	return param as ProfileResourceName;
}

/** The row id in the URL, or 400. */
function requireId(param: string | undefined): number {
	const id = Number(param);
	if (!Number.isInteger(id) || id <= 0) error(400, 'Invalid row id');
	return id;
}

/** The actor for a profile the signed-in user owns, or 403. */
async function requireProfileActor(profileId: number, userId: string): Promise<ProfileActor> {
	const owned = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profileId), eq(profiles.user_id, userId)),
		columns: { id: true }
	});
	if (!owned) error(403, 'Access denied');
	return { profileId, source: 'ui' };
}

/**
 * Who may create a row of this section.
 *
 * A parent-owned section is authorised through its parent, which is both the
 * stricter check and the one that needs no extra field: owning the role is
 * exactly what entitles you to add a project to it. The body's `profile_id` is
 * for the sections that have no parent to ask.
 */
async function actorForCreate(
	resource: ProfileResourceName,
	body: Record<string, unknown>,
	userId: string
): Promise<ProfileActor> {
	const { owner } = PROFILE_RESOURCES[resource];

	if (owner.via === 'parent') {
		const parentId = Number(body[owner.key]);
		if (!Number.isInteger(parentId) || parentId <= 0) {
			error(400, `${PROFILE_RESOURCES[resource].label} needs a ${owner.key}`);
		}
		return requireRowActor(owner.parent, parentId, userId);
	}

	const profileId = Number(body.profile_id);
	if (!Number.isInteger(profileId) || profileId <= 0) error(400, 'profile_id is required');
	return requireProfileActor(profileId, userId);
}

/** POST /api/profile-section/[resource] — add one row. */
export async function createSectionRow({
	params,
	request,
	locals
}: RequestEvent): Promise<Response> {
	const user = requireAuth(locals);
	const resource = requireResource(params.resource);

	const body = (await request.json()) as Record<string, unknown>;
	const actor = await actorForCreate(resource, body, user.id);

	const created = unwrapWrite(await createRow(resource, actor, body));

	// The row itself, not just its id: a client that just created a draft needs
	// the id to patch next, and the server-side defaults (`sort`, and the parent
	// name a parent-owned read attaches) to render it without a reload.
	return json({ success: true, id: created.id, row: created.row }, { status: 201 });
}

/** PATCH /api/profile-section/[resource]/[id] — change some of one row's fields. */
export async function patchSectionRow({
	params,
	request,
	locals
}: RequestEvent): Promise<Response> {
	const user = requireAuth(locals);
	const resource = requireResource(params.resource);
	const id = requireId(params.id);

	const actor = await requireRowActor(resource, id, user.id);
	await patchOwnedRow(resource, actor, id, (await request.json()) as Record<string, unknown>);

	// The row as it now stands, so a caller holding a stale copy of a derived
	// value — the parent's name after a move — does not have to reload for it.
	const row = await readOwnedRow(resource, actor, id);
	return json({ success: true, row });
}

/**
 * DELETE /api/profile-section/[resource]/[id] — remove one row for good.
 *
 * Hard, and deliberately not offered as an undo anywhere: a work-experience
 * project owns its technologies and any documents attached to it through
 * `ON DELETE CASCADE`, so what a re-create would restore is a row with the same
 * text and none of the things that hung off it. The UI confirms instead.
 */
export async function deleteSectionRow({ params, locals }: RequestEvent): Promise<Response> {
	const user = requireAuth(locals);
	const resource = requireResource(params.resource);
	const id = requireId(params.id);

	const actor = await requireRowActor(resource, id, user.id);
	unwrapWrite(await deleteRow(resource, actor, id));

	return json({ success: true });
}

const reorderSchema = z.object({
	profile_id: z.number().int().positive(),
	order: z.array(z.number().int().positive())
});

/**
 * POST /api/profile-section/[resource]/reorder — put the rows in this order.
 *
 * Ids the actor does not own are not an error and not a write; see
 * `reorderRows`. For a child collection the caller sends one parent's rows, and
 * the numbering is per-parent for free — `sort` is only ever read within the
 * group the row is in.
 */
export async function reorderSectionRows({
	params,
	request,
	locals
}: RequestEvent): Promise<Response> {
	const user = requireAuth(locals);
	const resource = requireResource(params.resource);

	const parsed = reorderSchema.safeParse(await request.json());
	if (!parsed.success) error(400, formatZodError(parsed.error));

	const actor = await requireProfileActor(parsed.data.profile_id, user.id);
	await reorderRows(resource, actor, parsed.data.order);

	return json({ success: true });
}
