/**
 * Presets: what each platform asks for, and the crops cut to them.
 *
 * The shared presets are seeded by migration (0086) from each platform's own
 * help page, with the page and the date its numbers were read; a profile adds
 * its own for a site that wants something odd.
 */

import { and, asc, desc, eq, isNull, or } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { media_presets, media_renditions } from '$lib/server/db/schema';
import {
	isMediaKind,
	isMediaMask,
	isOutputFormat,
	type MediaKind,
	type MediaMask,
	type MediaPresetView,
	type OutputFormat,
	type SafeZone
} from '$lib/media-library';
import { deleteUnusedRenditions } from './renditions';

type PresetRow = typeof media_presets.$inferSelect;

export function toPresetView(row: PresetRow): MediaPresetView {
	return {
		id: row.id,
		key: row.key,
		own: row.profile_id !== null,
		platform: row.platform,
		slot: row.slot,
		kind: isMediaKind(row.kind) ? row.kind : 'other',
		width: row.width,
		height: row.height,
		formats: (row.formats ?? []).filter(isOutputFormat),
		maxBytes: row.max_bytes,
		mask: isMediaMask(row.mask) ? row.mask : 'none',
		safeZone: Array.isArray(row.safe_zone) ? row.safe_zone : [],
		note: row.note,
		sourceUrl: row.source_url,
		verifiedOn: row.verified_on
	};
}

/** The shared presets and this profile's own, by platform. */
export async function listPresets(profileId: number): Promise<MediaPresetView[]> {
	const rows = await db.query.media_presets.findMany({
		where: or(isNull(media_presets.profile_id), eq(media_presets.profile_id, profileId)),
		orderBy: [asc(media_presets.platform), asc(media_presets.sort), asc(media_presets.id)]
	});
	return rows.map(toPresetView);
}

export interface NewPreset {
	platform: string;
	slot: string;
	kind: MediaKind;
	width: number;
	height: number;
	formats: OutputFormat[];
	maxBytes: number | null;
	mask: MediaMask;
	note: string | null;
	sourceUrl: string | null;
}

/** Read a preset from a form, or say what is wrong with it. */
export function parsePresetForm(form: FormData): NewPreset | string {
	const text = (name: string) => String(form.get(name) ?? '').trim();
	const platform = text('platform');
	const slot = text('slot');
	const width = Number(text('width'));
	const height = Number(text('height'));
	if (!platform || !slot) return 'Name the site and the image it asks for.';
	if (!Number.isInteger(width) || !Number.isInteger(height) || width < 16 || height < 16) {
		return 'Give the size in whole pixels, at least 16 each way.';
	}
	if (width > 8000 || height > 8000)
		return 'That is bigger than any site asks for (8000 pixels a side at most).';
	const formats = form.getAll('formats').map(String).filter(isOutputFormat);
	const maxKb = Number(text('maxKb'));
	const kind = text('kind');
	const mask = text('mask');
	const sourceUrl = text('sourceUrl');
	return {
		platform: platform.slice(0, 100),
		slot: slot.slice(0, 100),
		kind: isMediaKind(kind) ? kind : 'other',
		width,
		height,
		formats: formats.length ? formats : ['jpeg', 'png'],
		maxBytes: maxKb > 0 ? Math.round(maxKb * 1000) : null,
		mask: isMediaMask(mask) ? mask : 'none',
		note: text('note').slice(0, 1000) || null,
		sourceUrl: /^https?:\/\//i.test(sourceUrl) ? sourceUrl.slice(0, 500) : null
	};
}

export async function createOwnPreset(profileId: number, preset: NewPreset): Promise<number> {
	const [row] = await db
		.insert(media_presets)
		.values({
			profile_id: profileId,
			key: null,
			platform: preset.platform,
			slot: preset.slot,
			kind: preset.kind,
			width: preset.width,
			height: preset.height,
			formats: preset.formats,
			max_bytes: preset.maxBytes,
			mask: preset.mask,
			safe_zone: null as SafeZone[] | null,
			note: preset.note,
			source_url: preset.sourceUrl,
			verified_on: preset.sourceUrl ? new Date().toISOString().slice(0, 10) : null,
			date_created: new Date()
		})
		.returning({ id: media_presets.id });
	return row.id;
}

/**
 * Delete one of the profile's own presets, with the crops nothing uses. A
 * crop a slot shows or an application records keeps it: say so instead.
 */
export async function deleteOwnPreset(profileId: number, presetId: number): Promise<string | null> {
	const preset = await db.query.media_presets.findFirst({
		where: and(eq(media_presets.id, presetId), eq(media_presets.profile_id, profileId))
	});
	if (!preset) return 'No such preset.';
	const renditions = await db.query.media_renditions.findMany({
		where: eq(media_renditions.preset_id, presetId),
		columns: { id: true }
	});
	await deleteUnusedRenditions(renditions.map((r) => r.id));
	const left = await db.query.media_renditions.findFirst({
		where: eq(media_renditions.preset_id, presetId),
		columns: { id: true }
	});
	if (left)
		return 'A crop for this preset is in use (a slot shows it, or an application records it), so it stays.';
	await db.delete(media_presets).where(eq(media_presets.id, presetId));
	return null;
}

export interface CurrentCrop {
	renditionId: string;
	crop: { x: number; y: number; w: number; h: number };
	width: number;
	height: number;
	format: string;
	drawn: boolean;
}

/** The newest crop of an item for each preset it has been cut to. */
export async function currentCrops(itemId: number): Promise<Map<number, CurrentCrop>> {
	const rows = await db.query.media_renditions.findMany({
		where: eq(media_renditions.item_id, itemId),
		orderBy: [desc(media_renditions.date_created)]
	});
	const current = new Map<number, CurrentCrop>();
	for (const row of rows) {
		if (row.preset_id === null || current.has(row.preset_id)) continue;
		current.set(row.preset_id, {
			renditionId: row.id,
			crop: { x: row.crop_x, y: row.crop_y, w: row.crop_w, h: row.crop_h },
			width: row.width,
			height: row.height,
			format: row.format,
			drawn: row.file_id !== null
		});
	}
	return current;
}
