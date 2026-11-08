/**
 * Export a profile's media library: its originals, its own presets, and the
 * renditions cut from them.
 *
 * An item is nothing without its original, so the library travels only in an
 * archive that carries media. Each original goes in as it is stored (already
 * clean of metadata); each rendition that has been drawn goes in too, so a
 * slot restored from the archive shows the very same file it showed before
 * rather than a fresh draw of it.
 */

import { asc, eq, inArray } from 'drizzle-orm';
import { dbDirect } from '$lib/server/db';
import { media_items, media_presets, media_renditions } from '$lib/server/db/schema';
import { getFile } from '$lib/server/files';
import { isOutputFormat, OUTPUT_EXTENSIONS } from '$lib/media-library';
import { FORMAT_EXTENSIONS, type StoredFormat } from '$lib/server/media/originals';
import {
	MEDIA_ITEM_COLUMNS,
	MEDIA_PRESET_COLUMNS,
	MEDIA_RENDITION_COLUMNS
} from './export-columns';
import type {
	ArchiveFilePayload,
	ExportedMediaItem,
	ExportedMediaLibrary,
	ExportedMediaPreset,
	ExportedMediaRendition
} from './types';

export const MEDIA_LIBRARY_ARCHIVE_DIR = 'media-library';

export async function buildMediaLibraryExport(
	profileId: number
): Promise<{ library: ExportedMediaLibrary; files: ArchiveFilePayload[] }> {
	const files: ArchiveFilePayload[] = [];

	const itemRows = await dbDirect.query.media_items.findMany({
		where: eq(media_items.profile_id, profileId),
		columns: MEDIA_ITEM_COLUMNS,
		with: {
			file: { columns: { id: true } },
			template: { columns: { kind: true, slug: true } }
		},
		orderBy: asc(media_items.id)
	});

	const items: ExportedMediaItem[] = [];
	for (const row of itemRows) {
		if (!row.file) continue;
		let buffer: Buffer;
		try {
			buffer = await getFile(row.file.id);
		} catch (error) {
			// Without its original an item cannot be restored; its renditions go too.
			console.warn(`[Export] Media item ${row.id} has lost its original:`, error);
			continue;
		}
		const ext = FORMAT_EXTENSIONS[row.format as StoredFormat] ?? '';
		const archivePath = `${MEDIA_LIBRARY_ARCHIVE_DIR}/originals/${row.id}${ext}`;
		files.push({ archivePath, buffer });
		items.push({
			id: row.id,
			kind: row.kind,
			label: row.label,
			width: row.width,
			height: row.height,
			format: row.format,
			has_alpha: row.has_alpha,
			orientation: row.orientation,
			replaces_id: row.replaces_id,
			template: row.template ? { kind: row.template.kind, slug: row.template.slug } : null,
			date_created: row.date_created?.toISOString() ?? null,
			archivePath
		});
	}

	const presetRows = await dbDirect.query.media_presets.findMany({
		where: eq(media_presets.profile_id, profileId),
		columns: MEDIA_PRESET_COLUMNS,
		orderBy: asc(media_presets.id)
	});
	const presets: ExportedMediaPreset[] = presetRows.map((row) => ({
		id: row.id,
		platform: row.platform,
		slot: row.slot,
		kind: row.kind,
		width: row.width,
		height: row.height,
		formats: row.formats,
		max_bytes: row.max_bytes,
		mask: row.mask,
		safe_zone: row.safe_zone,
		note: row.note,
		source_url: row.source_url,
		verified_on: row.verified_on,
		sort: row.sort
	}));

	const exportedItemIds = new Set(items.map((item) => item.id));
	const renditionRows = exportedItemIds.size
		? await dbDirect.query.media_renditions.findMany({
				where: inArray(media_renditions.item_id, [...exportedItemIds]),
				columns: MEDIA_RENDITION_COLUMNS,
				with: {
					preset: { columns: { id: true, key: true, profile_id: true } },
					file: { columns: { id: true } }
				}
			})
		: [];

	const renditions: ExportedMediaRendition[] = [];
	for (const row of renditionRows) {
		let archivePath: string | undefined;
		if (row.file && isOutputFormat(row.format)) {
			try {
				const buffer = await getFile(row.file.id);
				archivePath = `${MEDIA_LIBRARY_ARCHIVE_DIR}/renditions/${row.id}${OUTPUT_EXTENSIONS[row.format]}`;
				files.push({ archivePath, buffer });
			} catch {
				// A cache that is gone is drawn again after import.
			}
		}
		renditions.push({
			id: row.id,
			item_id: row.item_id,
			preset: row.preset
				? row.preset.profile_id === null && row.preset.key
					? { key: row.preset.key }
					: { own: row.preset.id }
				: null,
			crop_x: row.crop_x,
			crop_y: row.crop_y,
			crop_w: row.crop_w,
			crop_h: row.crop_h,
			width: row.width,
			height: row.height,
			format: row.format,
			quality: row.quality,
			date_created: row.date_created?.toISOString() ?? null,
			archivePath
		});
	}

	return { library: { items, presets, renditions }, files };
}
