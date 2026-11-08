/**
 * Media: every picture a profile keeps, with its original.
 *
 * Profile photos, banners, logos and icons, kept once each as uploaded and cut
 * into renditions for the slots on the profile and for the platforms the
 * applicant signs up to (planning/MEDIA-LIBRARY.md). This page is the grid;
 * each item's own page has its crops, its downloads and where it is used.
 */

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { getSelectedProfileId } from '../utils';
import {
	createMediaItem,
	deleteMediaItem,
	listMediaItemViews,
	updateMediaItem
} from '$lib/server/media/items';
import { MediaUploadError } from '$lib/server/media/originals';
import { mediaUsage, usesByItem } from '$lib/server/media/usage';
import { stalePlatforms } from '$lib/server/media/live';
import { requireMediaQuota } from '$lib/server/billing/require-media-quota';
import { isMediaKind } from '$lib/media-library';

export const load: PageServerLoad = async ({ parent }) => {
	const layoutData = await parent();
	if (!layoutData.selectedProfile) redirect(302, '/home');
	const profileId = layoutData.selectedProfile.id;

	const [items, uses, stale] = await Promise.all([
		listMediaItemViews(profileId),
		mediaUsage(profileId),
		stalePlatforms(profileId)
	]);
	const grouped = usesByItem(uses);
	const replacedIds = new Set(items.map((item) => item.replacesId).filter((id) => id !== null));

	return {
		items: items.map((item) => ({
			...item,
			uses: grouped.get(item.id)?.length ?? 0,
			// A newer version exists: the grid shows the newest of each chain first.
			superseded: replacedIds.has(item.id)
		})),
		stale
	};
};

async function profileFor(event: Parameters<Actions[string]>[0]) {
	const user = event.locals.user;
	if (!user) redirect(302, '/login');
	const profileId = await getSelectedProfileId(event.cookies, user.id);
	if (!profileId) return { error: fail(400, { error: 'Choose a profile first.' }) };
	return { profileId, userId: user.id };
}

export const actions: Actions = {
	/** Add a picture, or a new version of one (`replacesId`). */
	upload: async (event) => {
		const who = await profileFor(event);
		if ('error' in who) return who.error;
		const form = await event.request.formData();
		const file = form.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'Choose a picture to upload.' });
		}
		const kind = String(form.get('kind') ?? 'other');
		const replacesId = Number(form.get('replacesId')) || null;

		await requireMediaQuota(who.userId, file.size);
		try {
			const item = await createMediaItem({
				profileId: who.profileId,
				kind: isMediaKind(kind) ? kind : 'other',
				label: String(form.get('label') ?? '').trim() || null,
				filename: file.name,
				bytes: Buffer.from(await file.arrayBuffer()),
				replacesId
			});
			return { uploaded: item.id };
		} catch (err) {
			if (err instanceof MediaUploadError) return fail(400, { error: err.message });
			throw err;
		}
	},

	update: async (event) => {
		const who = await profileFor(event);
		if ('error' in who) return who.error;
		const form = await event.request.formData();
		const itemId = Number(form.get('itemId'));
		const label = form.get('label');
		const kind = form.get('kind');
		const ok = await updateMediaItem(itemId, who.profileId, {
			label: typeof label === 'string' ? label : undefined,
			kind: typeof kind === 'string' ? kind : undefined
		});
		return ok ? { updated: itemId } : fail(404, { error: 'No such picture.' });
	},

	delete: async (event) => {
		const who = await profileFor(event);
		if ('error' in who) return who.error;
		const form = await event.request.formData();
		const ok = await deleteMediaItem(Number(form.get('itemId')), who.profileId);
		return ok ? { deleted: true } : fail(404, { error: 'No such picture.' });
	}
};
