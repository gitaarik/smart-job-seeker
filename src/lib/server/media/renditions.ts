/**
 * Renditions: finding one, drawing it, and letting it go.
 *
 * A rendition is named by everything it is made of (item, preset, crop, size,
 * format), so "make me this rendition" is a find-or-insert on that identity,
 * and two requests for the same picture get the same row and the same URL.
 * Its bytes are drawn on first need and kept as a `files` row; they can always
 * be drawn again from the original, which is what makes them a cache.
 */

import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import { media_items, media_presets, media_renditions } from '$lib/server/db/schema';
import { deleteFile, getFile, uploadFile } from '$lib/server/files';
import {
	OUTPUT_EXTENSIONS,
	isOutputFormat,
	type Crop,
	type OutputFormat
} from '$lib/media-library';
import { renderImage } from './render';
import { renditionInUseCondition } from './references';
import type { StoredFormat } from './originals';

export interface RenditionSpec {
	itemId: number;
	presetId: number | null;
	crop: Crop;
	width: number;
	height: number;
	format: OutputFormat;
}

const FILES_DIR = join(process.cwd(), 'uploads', 'files');

export const OUTPUT_MIME_TYPES: Record<OutputFormat, string> = {
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp'
};

/**
 * The format to write for a platform that accepts `formats`, preferred first.
 * Transparency is kept where the platform takes a format that can hold it;
 * otherwise the first one wins and transparency is flattened onto white.
 */
export function chooseFormat(formats: readonly string[], hasAlpha: boolean): OutputFormat {
	const accepted = formats.filter(isOutputFormat);
	if (accepted.length === 0) return hasAlpha ? 'png' : 'jpeg';
	if (hasAlpha) {
		const keepsAlpha = accepted.find((f) => f === 'png' || f === 'webp');
		if (keepsAlpha) return keepsAlpha;
	}
	return accepted[0];
}

/** Find the rendition with this identity, creating it if there is none. */
export async function findOrCreateRendition(spec: RenditionSpec): Promise<string> {
	const identity = and(
		eq(media_renditions.item_id, spec.itemId),
		spec.presetId === null
			? isNull(media_renditions.preset_id)
			: eq(media_renditions.preset_id, spec.presetId),
		eq(media_renditions.crop_x, spec.crop.x),
		eq(media_renditions.crop_y, spec.crop.y),
		eq(media_renditions.crop_w, spec.crop.w),
		eq(media_renditions.crop_h, spec.crop.h),
		eq(media_renditions.width, spec.width),
		eq(media_renditions.height, spec.height),
		eq(media_renditions.format, spec.format)
	);

	const existing = await db.query.media_renditions.findFirst({
		where: identity,
		columns: { id: true }
	});
	if (existing) return existing.id;

	const inserted = await db
		.insert(media_renditions)
		.values({
			item_id: spec.itemId,
			preset_id: spec.presetId,
			crop_x: spec.crop.x,
			crop_y: spec.crop.y,
			crop_w: spec.crop.w,
			crop_h: spec.crop.h,
			width: spec.width,
			height: spec.height,
			format: spec.format,
			date_created: new Date()
		})
		.onConflictDoNothing()
		.returning({ id: media_renditions.id });
	if (inserted[0]) return inserted[0].id;

	// Someone else inserted the same identity between the read and the write.
	const raced = await db.query.media_renditions.findFirst({
		where: identity,
		columns: { id: true }
	});
	if (!raced) throw new Error('Rendition vanished between insert and read.');
	return raced.id;
}

export interface RenderedRendition {
	id: string;
	fileId: string;
	filenameDisk: string;
	type: string;
	filesize: number;
	format: OutputFormat;
	width: number;
	height: number;
	/** Over the preset's size limit even at the lowest quality. */
	fits: boolean;
}

/** A file name a person would recognise in their Downloads folder. */
export function renditionFilename(
	label: string | null | undefined,
	preset: { platform: string; slot: string } | null,
	width: number,
	height: number,
	format: OutputFormat
): string {
	const parts = preset ? [preset.platform, preset.slot] : [label || 'image'];
	const base = parts
		.join(' ')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
	return `${base || 'image'}-${width}x${height}${OUTPUT_EXTENSIONS[format]}`;
}

/**
 * The rendition's bytes on disk, drawing them first if they are not there.
 *
 * Two requests may draw the same rendition at once; the write is a
 * compare-and-set on `file_id IS NULL`, and the loser deletes its copy, so a
 * rendition never ends up pointing at a file nobody else knows about.
 */
export async function ensureRendered(renditionId: string): Promise<RenderedRendition | null> {
	const row = await db.query.media_renditions.findFirst({
		where: eq(media_renditions.id, renditionId),
		with: {
			item: true,
			preset: { columns: { platform: true, slot: true, max_bytes: true } },
			file: { columns: { id: true, filename_disk: true, type: true, filesize: true } }
		}
	});
	if (!row || !isOutputFormat(row.format)) return null;

	const result = (
		fileId: string,
		filenameDisk: string,
		type: string,
		filesize: number,
		fits = true
	) => ({
		id: row.id,
		fileId,
		filenameDisk,
		type,
		filesize,
		format: row.format as OutputFormat,
		width: row.width,
		height: row.height,
		fits: fits && (!row.preset?.max_bytes || filesize <= row.preset.max_bytes)
	});

	if (row.file?.filename_disk) {
		try {
			// Present on disk: the cache holds. Gone: draw it again below.
			await stat(join(FILES_DIR, row.file.filename_disk));
			return result(
				row.file.id,
				row.file.filename_disk,
				row.file.type ?? OUTPUT_MIME_TYPES[row.format],
				row.file.filesize ?? 0
			);
		} catch {
			// fall through and redraw
		}
	}

	const original = await getFile(row.item.file_id);
	const rendered = await renderImage(
		{
			original,
			format: row.item.format as StoredFormat,
			orientation: row.item.orientation,
			width: row.item.width,
			height: row.item.height
		},
		{
			crop: { x: row.crop_x, y: row.crop_y, w: row.crop_w, h: row.crop_h },
			width: row.width,
			height: row.height,
			format: row.format,
			maxBytes: row.preset?.max_bytes ?? null
		}
	);

	const stored = await uploadFile({
		filename: renditionFilename(
			row.item.label,
			row.preset ?? null,
			row.width,
			row.height,
			row.format
		),
		buffer: rendered.bytes,
		title: `Rendition of media item ${row.item.id}`,
		mimeType: OUTPUT_MIME_TYPES[row.format]
	});

	const claimed = await db
		.update(media_renditions)
		.set({ file_id: stored.id, quality: rendered.quality })
		.where(
			row.file
				? and(eq(media_renditions.id, row.id), eq(media_renditions.file_id, row.file.id))
				: and(eq(media_renditions.id, row.id), isNull(media_renditions.file_id))
		)
		.returning({ id: media_renditions.id });

	if (!claimed[0]) {
		await deleteFile(stored.id);
		const winner = await db.query.media_renditions.findFirst({
			where: eq(media_renditions.id, row.id),
			with: { file: { columns: { id: true, filename_disk: true, type: true, filesize: true } } }
		});
		if (!winner?.file?.filename_disk) return null;
		return result(
			winner.file.id,
			winner.file.filename_disk,
			winner.file.type ?? OUTPUT_MIME_TYPES[row.format],
			winner.file.filesize ?? 0
		);
	}
	if (row.file) await deleteFile(row.file.id);
	return result(stored.id, stored.filename_disk, stored.type, stored.filesize, rendered.fits);
}

/**
 * Delete renditions nothing points at, and their cached bytes.
 *
 * "Nothing" is every foreign key to `media_renditions` (see references.ts),
 * checked in the same statement as the delete, so a slot that takes the
 * rendition a moment earlier keeps it.
 */
export async function deleteUnusedRenditions(ids: string[]): Promise<number> {
	if (ids.length === 0) return 0;
	const idList = sql.join(
		ids.map((id) => sql`${id}::uuid`),
		sql`, `
	);
	const deleted = await queryRawDirect<{ file_id: string | null }>(sql`
		DELETE FROM media_renditions r
		 WHERE r.id IN (${idList})
		   AND NOT ${renditionInUseCondition(sql`r.id`)}
		RETURNING r.file_id
	`);
	for (const row of deleted) {
		if (row.file_id) await deleteFile(row.file_id).catch(() => {});
	}
	return deleted.length;
}

/**
 * The renditions of one item for one preset other than `keep`, which nothing
 * points at: the crops someone tried before the one they settled on.
 */
export async function pruneSupersededCrops(
	itemId: number,
	presetId: number | null,
	keep: string
): Promise<void> {
	const rows = await db.query.media_renditions.findMany({
		where: and(
			eq(media_renditions.item_id, itemId),
			presetId === null
				? isNull(media_renditions.preset_id)
				: eq(media_renditions.preset_id, presetId)
		),
		columns: { id: true }
	});
	await deleteUnusedRenditions(rows.map((r) => r.id).filter((id) => id !== keep));
}

/** The preset row a rendition spec needs, or null when the id is not one this profile can use. */
export async function presetForProfile(presetId: number, profileId: number) {
	const preset = await db.query.media_presets.findFirst({ where: eq(media_presets.id, presetId) });
	if (!preset) return null;
	if (preset.profile_id !== null && preset.profile_id !== profileId) return null;
	return preset;
}

/** An item, when it belongs to this profile. */
export async function itemForProfile(itemId: number, profileId: number) {
	const item = await db.query.media_items.findFirst({
		where: and(eq(media_items.id, itemId), eq(media_items.profile_id, profileId))
	});
	return item ?? null;
}
