/**
 * A profile's media library: list it, or add to it.
 *
 * The profile is `?profileId=` (or the `profileId` form field), checked
 * against the caller, falling back to the selected profile. A slot picker
 * passes the profile of the row it is on, so it never shows another profile's
 * pictures because of what happens to be selected in another tab.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth, requireProfileAccess } from '$lib/server/utils/api-helpers';
import { getSelectedProfileId } from '$lib/server/profile/selected-profile';
import { createMediaItem, listMediaItemViews, toItemView } from '$lib/server/media/items';
import { MediaUploadError } from '$lib/server/media/originals';
import { isMediaKind } from '$lib/media-library';

async function profileFor(
	raw: string | null,
	cookies: Parameters<RequestHandler>[0]['cookies'],
	userId: string
): Promise<number> {
	if (raw) {
		const id = Number(raw);
		if (!Number.isInteger(id) || id <= 0) error(400, 'Invalid profile');
		await requireProfileAccess(id, userId);
		return id;
	}
	const selected = await getSelectedProfileId(cookies, userId);
	if (!selected) error(400, 'No profile selected');
	return selected;
}

export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	const user = requireAuth(locals);
	const profileId = await profileFor(url.searchParams.get('profileId'), cookies, user.id);
	return json({ items: await listMediaItemViews(profileId) });
};

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	const user = requireAuth(locals);
	const form = await request.formData();
	const profileId = await profileFor(
		(form.get('profileId') as string | null) || null,
		cookies,
		user.id
	);
	const file = form.get('file');
	if (!(file instanceof File) || file.size === 0) error(400, 'Choose an image to upload');
	const kind = String(form.get('kind') ?? 'other');

	try {
		const item = await createMediaItem({
			profileId,
			kind: isMediaKind(kind) ? kind : 'other',
			label: (form.get('label') as string | null) || null,
			filename: file.name,
			bytes: Buffer.from(await file.arrayBuffer())
		});
		return json({ item: toItemView(item, file.size) });
	} catch (err) {
		if (err instanceof MediaUploadError) error(400, err.message);
		throw err;
	}
};
