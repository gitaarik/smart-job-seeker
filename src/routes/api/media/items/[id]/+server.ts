/** One library item: rename it, refile it, or delete it with its renditions. */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth, parseIntParam } from '$lib/server/utils/api-helpers';
import { ownedItem } from '$lib/server/media/serve';
import { deleteMediaItem, updateMediaItem } from '$lib/server/media/items';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const item = await ownedItem(parseIntParam(params.id, 'item'), user.id);
	if (!item) error(404, 'Not found');
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	await updateMediaItem(item.id, item.profile_id, {
		label: typeof body.label === 'string' ? body.label : undefined,
		kind: typeof body.kind === 'string' ? body.kind : undefined
	});
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	const item = await ownedItem(parseIntParam(params.id, 'item'), user.id);
	if (!item) error(404, 'Not found');
	await deleteMediaItem(item.id, item.profile_id);
	return json({ success: true });
};
