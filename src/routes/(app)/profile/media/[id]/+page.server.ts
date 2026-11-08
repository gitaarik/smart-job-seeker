/**
 * One picture in the media library: its original, where it is used, its
 * versions, and a crop for each platform that asks for one.
 *
 * A crop is saved as a rendition and drawn at once, so the warnings that need
 * the real file (over the platform's size limit) can be shown before anyone
 * downloads it. The crops someone tried before the one they kept are deleted,
 * unless something still points at them.
 */

import type { Actions, PageServerLoad } from './$types';
import { error, fail, isHttpError, redirect } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { applications, media_items } from '$lib/server/db/schema';
import { getSelectedProfileId } from '../../utils';
import {
	createMediaItem,
	deleteMediaItem,
	toItemView,
	updateMediaItem
} from '$lib/server/media/items';
import { MediaUploadError } from '$lib/server/media/originals';
import { mediaUsage } from '$lib/server/media/usage';
import {
	createOwnPreset,
	currentCrops,
	deleteOwnPreset,
	listPresets,
	parsePresetForm
} from '$lib/server/media/presets';
import {
	chooseFormat,
	ensureRendered,
	findOrCreateRendition,
	itemForProfile,
	presetForProfile,
	pruneSupersededCrops
} from '$lib/server/media/renditions';
import { replaceInSlots } from '$lib/server/media/slots';
import { recordUpload } from '$lib/server/media/live';
import { centredCrop, clampCrop, cropWarnings, isMediaKind, type Crop } from '$lib/media-library';

export const load: PageServerLoad = async ({ params, parent }) => {
	const layoutData = await parent();
	if (!layoutData.selectedProfile) redirect(302, '/home');
	const profileId = layoutData.selectedProfile.id;

	const itemId = Number(params.id);
	const row = Number.isInteger(itemId)
		? await db.query.media_items.findFirst({
				where: and(eq(media_items.id, itemId), eq(media_items.profile_id, profileId)),
				with: {
					file: { columns: { filesize: true } },
					replaces: { columns: { id: true, label: true, profile_id: true } },
					replaced_by: { columns: { id: true, label: true, profile_id: true } },
					template: { columns: { id: true, name: true } }
				}
			})
		: undefined;
	if (!row) redirect(302, '/profile/media');

	const [uses, presets, crops, platforms] = await Promise.all([
		mediaUsage(profileId, [row.id]),
		listPresets(profileId),
		currentCrops(row.id),
		// The applications a picture can be recorded as uploaded to.
		applicationNames(profileId)
	]);

	// Draw every saved crop now, so the size warning below reads the real file.
	const drawn = new Map<string, { bytes: number; fits: boolean }>();
	for (const crop of crops.values()) {
		const rendered = await ensureRendered(crop.renditionId);
		if (rendered) drawn.set(crop.renditionId, { bytes: rendered.filesize, fits: rendered.fits });
	}

	const item = toItemView(row, row.file?.filesize ?? null);
	return {
		item,
		// Within the profile only: createMediaItem refuses a link across profiles,
		// and this is the second lock on showing one.
		replaces:
			row.replaces?.profile_id === profileId
				? { id: row.replaces.id, label: row.replaces.label }
				: null,
		replacedBy: row.replaced_by
			.filter((newer) => newer.profile_id === profileId)
			.map((newer) => ({ id: newer.id, label: newer.label })),
		template: row.template ?? null,
		uses,
		applications: platforms,
		presets: presets.map((preset) => {
			const current = crops.get(preset.id) ?? null;
			const crop =
				current?.crop ?? centredCrop(item.width, item.height, preset.width / preset.height);
			const file = current ? drawn.get(current.renditionId) : undefined;
			const warnings = cropWarnings(crop, preset);
			if (file && !file.fits && preset.maxBytes) {
				warnings.push({
					kind: 'too-big',
					message: `No quality gets this under the ${Math.round(preset.maxBytes / 1000)} KB limit; it comes out at ${Math.round(file.bytes / 1000)} KB.`
				});
			}
			if (current && (current.width !== preset.width || current.height !== preset.height)) {
				warnings.push({
					kind: 'size-changed',
					message: `This crop was drawn at ${current.width}x${current.height}; the preset now asks for ${preset.width}x${preset.height}. Save the crop again.`
				});
			}
			return {
				preset,
				current: current ? { ...current, bytes: file?.bytes ?? null } : null,
				startCrop: crop,
				warnings,
				suits: preset.kind === item.kind
			};
		})
	};
};

/** The profile's applications, named the way their own pages name them. */
async function applicationNames(profileId: number) {
	const rows = await db.query.applications.findMany({
		where: eq(applications.profile_id, profileId),
		columns: { id: true },
		with: { job: { columns: { title: true, company: true } } },
		orderBy: desc(applications.date_created),
		limit: 300
	});
	return rows.map((r) => ({
		id: r.id,
		name: [r.job?.company, r.job?.title].filter(Boolean).join(': ') || `Application ${r.id}`
	}));
}

async function profileFor(event: {
	locals: App.Locals;
	cookies: Parameters<typeof getSelectedProfileId>[0];
}) {
	const user = event.locals.user;
	if (!user) redirect(302, '/login');
	const profileId = await getSelectedProfileId(event.cookies, user.id);
	if (!profileId) error(400, 'Choose a profile first.');
	return { profileId, userId: user.id };
}

function parseCrop(raw: FormDataEntryValue | null): Crop | null {
	if (typeof raw !== 'string') return null;
	try {
		const { x, y, w, h } = JSON.parse(raw) as Record<string, unknown>;
		if ([x, y, w, h].every((n) => typeof n === 'number' && Number.isFinite(n))) {
			return { x, y, w, h } as Crop;
		}
	} catch {
		// not a crop
	}
	return null;
}

export const actions: Actions = {
	/** Save a crop for a preset: a rendition, drawn at once. */
	saveCrop: async (event) => {
		const { profileId } = await profileFor(event);
		const form = await event.request.formData();
		const item = await itemForProfile(Number(event.params.id), profileId);
		const preset = await presetForProfile(Number(form.get('presetId')), profileId);
		const crop = parseCrop(form.get('crop'));
		if (!item || !preset || !crop) return fail(400, { error: 'Could not save that crop.' });

		const renditionId = await findOrCreateRendition({
			itemId: item.id,
			presetId: preset.id,
			crop: clampCrop(crop, item.width, item.height),
			width: preset.width,
			height: preset.height,
			format: chooseFormat(preset.formats, item.has_alpha)
		});
		await ensureRendered(renditionId);
		await pruneSupersededCrops(item.id, preset.id, renditionId);
		return { saved: preset.id };
	},

	update: async (event) => {
		const { profileId } = await profileFor(event);
		const form = await event.request.formData();
		const label = form.get('label');
		const kind = form.get('kind');
		await updateMediaItem(Number(event.params.id), profileId, {
			label: typeof label === 'string' ? label : undefined,
			kind: typeof kind === 'string' ? kind : undefined
		});
		return { updated: true };
	},

	/** A new version of this picture: a new item that replaces this one. */
	uploadVersion: async (event) => {
		const { profileId } = await profileFor(event);
		const item = await itemForProfile(Number(event.params.id), profileId);
		if (!item) return fail(404, { error: 'No such picture.' });
		const form = await event.request.formData();
		const file = form.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'Choose the new version to upload.' });
		}
		let created;
		try {
			created = await createMediaItem({
				profileId,
				kind: isMediaKind(item.kind) ? item.kind : 'other',
				label: item.label,
				filename: file.name,
				bytes: Buffer.from(await file.arrayBuffer()),
				replacesId: item.id
			});
		} catch (err) {
			if (err instanceof MediaUploadError) return fail(400, { error: err.message });
			if (isHttpError(err)) return fail(err.status, { error: err.body.message });
			throw err;
		}
		if (form.get('useEverywhere')) await replaceInSlots(item.id, created.id, profileId);
		redirect(303, `/profile/media/${created.id}`);
	},

	/** Show this version wherever the one it replaces shows on the profile. */
	useEverywhere: async (event) => {
		const { profileId } = await profileFor(event);
		const item = await itemForProfile(Number(event.params.id), profileId);
		if (!item?.replaces_id) return fail(400, { error: 'This picture does not replace another.' });
		const moved = await replaceInSlots(item.replaces_id, item.id, profileId);
		return { moved };
	},

	delete: async (event) => {
		const { profileId } = await profileFor(event);
		await deleteMediaItem(Number(event.params.id), profileId);
		redirect(303, '/profile/media');
	},

	addPreset: async (event) => {
		const { profileId } = await profileFor(event);
		const parsed = parsePresetForm(await event.request.formData());
		if (typeof parsed === 'string') return fail(400, { presetError: parsed });
		await createOwnPreset(profileId, parsed);
		return { presetAdded: true };
	},

	deletePreset: async (event) => {
		const { profileId } = await profileFor(event);
		const form = await event.request.formData();
		const problem = await deleteOwnPreset(profileId, Number(form.get('presetId')));
		return problem ? fail(400, { presetError: problem }) : { presetDeleted: true };
	},

	/** Record that this crop went up on a platform (an application). */
	recordUpload: async (event) => {
		const { profileId } = await profileFor(event);
		const form = await event.request.formData();
		const problem = await recordUpload(
			profileId,
			Number(form.get('applicationId')),
			String(form.get('renditionId') ?? ''),
			String(form.get('dateUploaded') ?? '')
		);
		return problem ? fail(400, { error: problem }) : { recorded: true };
	}
};
