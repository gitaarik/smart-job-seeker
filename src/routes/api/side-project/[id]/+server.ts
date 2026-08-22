/**
 * One side project's own fields.
 *
 * Its child collections — technologies and achievements — used to be here too,
 * as whole-list PATCHes that reconciled by deleting whatever the payload did not
 * mention. They are sections in their own right now and are written one row at a
 * time through `/api/profile-section/[resource]`, which is what let the editor
 * stop asking for a Save click. See `section-endpoint.ts` for why a reconciling
 * collection write and auto-save cannot be the same thing.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { patchOwnedRow, requireRowActor } from '$lib/server/profile/write-http';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const projectId = parseIntParam(params.id, 'project');

	const actor = await requireRowActor('side_project', projectId, user.id);

	await patchOwnedRow('side_project', actor, projectId, await request.json());
	return json({ success: true });
};
