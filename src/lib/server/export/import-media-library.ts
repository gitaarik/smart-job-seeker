/**
 * Restore a media library from an archive, and point the restored profile's
 * slots back at it.
 *
 * Everything is remapped: the archive names items, presets and renditions by
 * their source ids, and this makes new ones. A shared preset is found by its
 * key; one this database does not have (an older instance, say) turns its
 * renditions into free crops rather than dropping them.
 */

import { isHttpError } from '@sveltejs/kit';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { dbDirect, queryRawDirect } from '$lib/server/db';
import { media_items, media_presets, media_renditions, profiles } from '$lib/server/db/schema';
import { deleteFile, uploadFile } from '$lib/server/files';
import { reapFileRefs } from '$lib/server/uploads/reap';
import {
	clampCrop,
	isMediaKind,
	isMediaMask,
	isOutputFormat,
	OUTPUT_EXTENSIONS,
	type SafeZone
} from '$lib/media-library';
import { FORMAT_EXTENSIONS, FORMAT_MIME_TYPES, prepareOriginal } from '$lib/server/media/originals';
import { OUTPUT_MIME_TYPES } from '$lib/server/media/renditions';
import { insertWithinBudget } from '$lib/server/media/items';
import type { ExportedMediaLibrary } from './types';

export interface MediaLibraryIdMaps {
	/** Source item id -> new item id. */
	items: Map<number, number>;
	/** Source rendition id -> new rendition id. */
	renditions: Map<string, string>;
	/** Source item id -> the template it was rendered from, set once templates exist. */
	itemTemplates: Map<number, { kind: string; slug: string }>;
}

/**
 * How the template importer names the templates it made, and how a restored
 * item finds the banner template it was drawn from. One function, because two
 * spellings of the same key are how the first real round trip lost every
 * banner's link to its template.
 */
export function templateKey(kind: string, slug: string): string {
	return `${kind}:${slug}`;
}

export function emptyMediaLibraryIdMaps(): MediaLibraryIdMaps {
	return { items: new Map(), renditions: new Map(), itemTemplates: new Map() };
}

function validOrientation(value: unknown): number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 8
		? value
		: 1;
}

export async function importMediaLibrary(
	profileId: number,
	library: ExportedMediaLibrary,
	files: Map<string, Buffer>
): Promise<MediaLibraryIdMaps> {
	const maps = emptyMediaLibraryIdMaps();
	const now = new Date();

	// A profile's own presets first: renditions refer to them.
	const ownPresets = new Map<number, number>();
	for (const preset of library.presets ?? []) {
		if (!preset.platform || !preset.slot || !(preset.width > 0) || !(preset.height > 0)) continue;
		const [row] = await dbDirect
			.insert(media_presets)
			.values({
				profile_id: profileId,
				key: null,
				platform: preset.platform.slice(0, 100),
				slot: preset.slot.slice(0, 100),
				kind: isMediaKind(preset.kind) ? preset.kind : 'other',
				width: Math.round(preset.width),
				height: Math.round(preset.height),
				formats: (preset.formats ?? []).filter(isOutputFormat),
				max_bytes: preset.max_bytes ?? null,
				mask: isMediaMask(preset.mask) ? preset.mask : 'none',
				safe_zone: Array.isArray(preset.safe_zone) ? (preset.safe_zone as SafeZone[]) : null,
				note: preset.note ?? null,
				source_url: preset.source_url ?? null,
				verified_on: preset.verified_on ?? null,
				sort: preset.sort ?? null,
				date_created: now
			})
			.returning({ id: media_presets.id });
		ownPresets.set(preset.id, row.id);
	}

	// Items. The original is checked like any upload (which also takes out any
	// metadata an archive from elsewhere might carry), but its orientation and
	// size come from the row: the stored bytes no longer say which way is up.
	// Each insert goes through the account's media budget under its lock, like
	// an upload; the import route checks the archive's total up front, and this
	// is what holds if another upload lands in between.
	const owner = await dbDirect.query.profiles.findFirst({
		where: eq(profiles.id, profileId),
		columns: { user_id: true }
	});
	const itemDims = new Map<number, { width: number; height: number }>();
	let overBudget = false;
	for (const item of library.items ?? []) {
		if (overBudget) break;
		const buffer = files.get(item.archivePath);
		if (!buffer) {
			console.warn(`[Import] Media original missing from archive: ${item.archivePath}`);
			continue;
		}
		try {
			const prepared = await prepareOriginal(buffer);
			const orientation =
				prepared.orientation !== 1 ? prepared.orientation : validOrientation(item.orientation);
			const sideways = orientation >= 5 && prepared.orientation === 1;
			const width = sideways ? prepared.height : prepared.width;
			const height = sideways ? prepared.width : prepared.height;
			const stem = (item.label || 'image').slice(0, 100);
			const stored = await uploadFile({
				filename: `${stem}${FORMAT_EXTENSIONS[prepared.format]}`,
				buffer: prepared.bytes,
				title: stem,
				mimeType: FORMAT_MIME_TYPES[prepared.format]
			});
			let row: { id: number };
			try {
				row = await insertWithinBudget(owner?.user_id ?? null, prepared.bytes.length, {
					profile_id: profileId,
					kind: isMediaKind(item.kind) ? item.kind : 'other',
					label: item.label ?? null,
					file_id: stored.id,
					width,
					height,
					format: prepared.format,
					has_alpha: prepared.hasAlpha,
					orientation,
					date_created: item.date_created ? new Date(item.date_created) : now
				});
			} catch (err) {
				await deleteFile(stored.id).catch(() => {});
				throw err;
			}
			maps.items.set(item.id, row.id);
			itemDims.set(row.id, { width, height });
			if (item.template?.kind && item.template.slug) maps.itemTemplates.set(item.id, item.template);
		} catch (error) {
			if (isHttpError(error) && error.status === 403) {
				// Over the media budget: what is restored stays, the rest is skipped.
				console.warn(`[Import] Media budget reached; the rest of the library is not restored.`);
				overBudget = true;
				continue;
			}
			console.warn(`[Import] Could not restore media item ${item.label ?? item.id}:`, error);
		}
	}

	// New versions name the item they replace; both now exist.
	for (const item of library.items ?? []) {
		const id = maps.items.get(item.id);
		const replaces = item.replaces_id != null ? maps.items.get(item.replaces_id) : undefined;
		if (id && replaces) {
			await dbDirect
				.update(media_items)
				.set({ replaces_id: replaces })
				.where(eq(media_items.id, id));
		}
	}

	// Shared presets by key, looked up once.
	const keys = [
		...new Set(
			(library.renditions ?? [])
				.map((r) => (r.preset && 'key' in r.preset ? r.preset.key : null))
				.filter((key): key is string => !!key)
		)
	];
	const sharedPresets = new Map<string, number>();
	if (keys.length) {
		const rows = await dbDirect.query.media_presets.findMany({
			where: and(isNull(media_presets.profile_id), inArray(media_presets.key, keys)),
			columns: { id: true, key: true }
		});
		for (const row of rows) if (row.key) sharedPresets.set(row.key, row.id);
	}

	for (const rendition of library.renditions ?? []) {
		const itemId = maps.items.get(rendition.item_id);
		if (!itemId || !isOutputFormat(rendition.format)) continue;
		const dims = itemDims.get(itemId);
		if (!dims) continue;
		const presetId = !rendition.preset
			? null
			: 'key' in rendition.preset
				? (sharedPresets.get(rendition.preset.key) ?? null)
				: (ownPresets.get(rendition.preset.own) ?? null);
		const crop = clampCrop(
			{ x: rendition.crop_x, y: rendition.crop_y, w: rendition.crop_w, h: rendition.crop_h },
			dims.width,
			dims.height
		);

		let fileId: string | null = null;
		const bytes = rendition.archivePath ? files.get(rendition.archivePath) : undefined;
		if (bytes) {
			const stored = await uploadFile({
				filename: `rendition-${rendition.width}x${rendition.height}${OUTPUT_EXTENSIONS[rendition.format]}`,
				buffer: bytes,
				title: `Rendition of media item ${itemId}`,
				mimeType: OUTPUT_MIME_TYPES[rendition.format]
			});
			fileId = stored.id;
		}

		const inserted = await dbDirect
			.insert(media_renditions)
			.values({
				item_id: itemId,
				preset_id: presetId,
				crop_x: crop.x,
				crop_y: crop.y,
				crop_w: crop.w,
				crop_h: crop.h,
				width: Math.max(1, Math.round(rendition.width)),
				height: Math.max(1, Math.round(rendition.height)),
				format: rendition.format,
				quality: rendition.quality ?? null,
				file_id: fileId,
				date_created: rendition.date_created ? new Date(rendition.date_created) : now
			})
			.onConflictDoNothing()
			.returning({ id: media_renditions.id });

		if (inserted[0]) {
			maps.renditions.set(rendition.id, inserted[0].id);
			continue;
		}
		// Two archive renditions that became one here (a preset this database
		// lacks made both free crops of the same shape): the first one stands.
		if (fileId) await deleteFile(fileId).catch(() => {});
		const existing = await dbDirect.query.media_renditions.findFirst({
			where: and(
				eq(media_renditions.item_id, itemId),
				presetId === null
					? isNull(media_renditions.preset_id)
					: eq(media_renditions.preset_id, presetId),
				eq(media_renditions.crop_x, crop.x),
				eq(media_renditions.crop_y, crop.y),
				eq(media_renditions.crop_w, crop.w),
				eq(media_renditions.crop_h, crop.h),
				eq(media_renditions.width, Math.max(1, Math.round(rendition.width))),
				eq(media_renditions.height, Math.max(1, Math.round(rendition.height))),
				eq(media_renditions.format, rendition.format)
			),
			columns: { id: true }
		});
		if (existing) maps.renditions.set(rendition.id, existing.id);
	}

	return maps;
}

/**
 * Point the restored entities' slots at the restored renditions. Takes the
 * slot values as they were exported (source rendition ids) and the ids the
 * import gave each entity.
 */
export async function restoreSlotRenditions(
	maps: MediaLibraryIdMaps,
	slots: { table: string; column: string; id: number; source: string | null | undefined }[]
): Promise<Set<string>> {
	const restored = new Set<string>();
	for (const slot of slots) {
		if (!slot.source) continue;
		const renditionId = maps.renditions.get(slot.source);
		if (!renditionId) continue;
		await queryRawDirect(sql`
			UPDATE ${sql.identifier(slot.table)}
			   SET ${sql.identifier(slot.column)} = ${renditionId}::uuid
			 WHERE id = ${slot.id}
		`);
		restored.add(slotKey(slot.table, slot.id, slot.column));
	}
	return restored;
}

/** A slot as `restoreSlotRenditions` reports it: table, row and column. */
export function slotKey(table: string, id: number, column: string): string {
	return `${table}:${id}:${column}`;
}

/** Link restored items to the banner templates they were rendered from. */
export async function restoreItemTemplates(
	maps: MediaLibraryIdMaps,
	templateIds: Map<string, number>
): Promise<void> {
	for (const [sourceItemId, template] of maps.itemTemplates) {
		const itemId = maps.items.get(sourceItemId);
		const templateId = templateIds.get(templateKey(template.kind, template.slug));
		if (itemId && templateId) {
			await dbDirect
				.update(media_items)
				.set({ template_id: templateId })
				.where(eq(media_items.id, itemId));
		}
	}
}

/**
 * Empty a profile's library before an overwrite import that carries one, so
 * the import does not stack a second copy of every picture on the first.
 * Only called when the archive has a library to put back.
 */
export async function deleteProfileMediaLibrary(profileId: number): Promise<void> {
	const items = await dbDirect.query.media_items.findMany({
		where: eq(media_items.profile_id, profileId),
		columns: { id: true, file_id: true },
		with: { renditions: { columns: { file_id: true } } }
	});
	const fileIds = items.flatMap((item) => [
		item.file_id,
		...item.renditions.map((r) => r.file_id).filter((id): id is string => !!id)
	]);
	await dbDirect.delete(media_items).where(eq(media_items.profile_id, profileId));
	await dbDirect.delete(media_presets).where(eq(media_presets.profile_id, profileId));
	if (fileIds.length) await reapFileRefs({ fileIds, mediaPaths: [] });
}
