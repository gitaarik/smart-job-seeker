import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseIntParam, requireAuth } from '#lib/server/utils/api-helpers.ts';
import { patchOwnedRow, requireRowActor } from '#lib/server/profile/write-http.ts';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const educationId = parseIntParam(params.id, 'education');

	// Ownership, validation, coercion and the profile touch all live in the
	// write layer, which the education page's form actions go through too.
	const actor = await requireRowActor('education', educationId, user.id);
	await patchOwnedRow('education', actor, educationId, await request.json());

	return json({ success: true });
};
