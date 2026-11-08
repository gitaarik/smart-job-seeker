/**
 * Media items: adding an original to a profile's library, and taking one out.
 */

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import {
	media_items,
	media_renditions,
	presentation_templates,
	profiles
} from '$lib/server/db/schema';
import { deleteFile, uploadFile } from '$lib/server/files';
import { requireMediaQuota } from '$lib/server/billing/require-media-quota';
import {
	isMediaKind,
	itemPreviewUrl,
	type MediaItemView,
	type MediaKind
} from '$lib/media-library';
import {
	FORMAT_EXTENSIONS,
	FORMAT_MIME_TYPES,
	MediaUploadError,
	prepareOriginal
} from './originals';
import { deleteUnusedRenditions } from './renditions';

export type MediaItemRow = typeof media_items.$inferSelect;

export interface NewMediaItem {
	profileId: number;
	kind: MediaKind;
	label?: string | null;
	/** What the uploader called the file; only its stem is kept. */
	filename: string;
	bytes: Buffer;
	/** The item this one is a new version of. */
	replacesId?: number | null;
	/** Set when the original was rendered from a banner template. */
	templateId?: number | null;
}

/** `Rik photo 2026.HEIC` -> `Rik photo 2026`. */
export function filenameStem(filename: string): string {
	const base = (filename.split(/[\\/]/).pop() ?? '').trim();
	const dot = base.lastIndexOf('.');
	return (dot > 0 ? base.slice(0, dot) : base).slice(0, 200);
}

/**
 * Store an upload as a new item. Throws `MediaUploadError` with a sentence for
 * the uploader when the file cannot be taken, and SvelteKit's 403 when it does
 * not fit the account's media budget.
 *
 * Every way into the library comes through here (a slot, the grid, the picker,
 * a new version, a banner drawing, an archive from before the library), so
 * this is where the budget is checked and where the ids a caller hands in are
 * held to the same profile: a door added later cannot skip either.
 */
export async function createMediaItem(input: NewMediaItem): Promise<MediaItemRow> {
	const [owner, replaces, template] = await Promise.all([
		db.query.profiles.findFirst({
			where: eq(profiles.id, input.profileId),
			columns: { user_id: true }
		}),
		input.replacesId
			? db.query.media_items.findFirst({
					where: and(
						eq(media_items.id, input.replacesId),
						eq(media_items.profile_id, input.profileId)
					),
					columns: { id: true }
				})
			: undefined,
		input.templateId
			? db.query.presentation_templates.findFirst({
					where: and(
						eq(presentation_templates.id, input.templateId),
						eq(presentation_templates.profile_id, input.profileId)
					),
					columns: { id: true }
				})
			: undefined
	]);
	if (!owner) throw new MediaUploadError('No such profile.');
	if (input.replacesId && !replaces) {
		throw new MediaUploadError("The picture this replaces is not in this profile's library.");
	}

	const prepared = await prepareOriginal(input.bytes);
	const stem = filenameStem(input.filename) || 'image';
	const stored = await uploadFile({
		filename: `${stem}${FORMAT_EXTENSIONS[prepared.format]}`,
		buffer: prepared.bytes,
		title: input.label || stem,
		mimeType: FORMAT_MIME_TYPES[prepared.format]
	});

	try {
		return await db.transaction(async (tx) => {
			if (owner.user_id) {
				// One store at a time per account between the budget check and the
				// insert, and the check reads through this transaction: two uploads at
				// once could otherwise both fit under the cap that together they break.
				await tx.execute(
					sql`SELECT pg_advisory_xact_lock(hashtext(${`media-quota:${owner.user_id}`}))`
				);
				await requireMediaQuota(owner.user_id, prepared.bytes.length, tx);
			}
			const [row] = await tx
				.insert(media_items)
				.values({
					profile_id: input.profileId,
					kind: isMediaKind(input.kind) ? input.kind : 'other',
					label: input.label?.trim() || stem,
					file_id: stored.id,
					width: prepared.width,
					height: prepared.height,
					format: prepared.format,
					has_alpha: prepared.hasAlpha,
					orientation: prepared.orientation,
					replaces_id: replaces?.id ?? null,
					template_id: template?.id ?? null,
					date_created: new Date()
				})
				.returning();
			return row;
		});
	} catch (err) {
		await deleteFile(stored.id).catch(() => {});
		throw err;
	}
}

/** Every item of a profile, newest first. */
export async function listMediaItems(profileId: number): Promise<MediaItemRow[]> {
	return db.query.media_items.findMany({
		where: eq(media_items.profile_id, profileId),
		orderBy: [desc(media_items.date_created), desc(media_items.id)]
	});
}

/**
 * Delete an item, its renditions and every slot showing one of them.
 *
 * The slots are emptied by their foreign keys (`ON DELETE SET NULL`, and the
 * template asset row is deleted outright), so this needs to know nothing about
 * where the item was used; the page lists that before asking. The original's
 * bytes and every cached rendition go with it.
 */
export async function deleteMediaItem(itemId: number, profileId: number): Promise<boolean> {
	const item = await db.query.media_items.findFirst({
		where: and(eq(media_items.id, itemId), eq(media_items.profile_id, profileId)),
		with: { renditions: { columns: { file_id: true } } }
	});
	if (!item) return false;

	const renditionFiles = item.renditions.map((r) => r.file_id).filter((id): id is string => !!id);
	await db.delete(media_items).where(eq(media_items.id, item.id));
	for (const fileId of [item.file_id, ...renditionFiles]) {
		await deleteFile(fileId).catch(() => {});
	}
	return true;
}

/** Rename an item or file it under another kind. */
export async function updateMediaItem(
	itemId: number,
	profileId: number,
	changes: { label?: string | null; kind?: string }
): Promise<boolean> {
	const set: Partial<MediaItemRow> = {};
	if (changes.label !== undefined) set.label = changes.label?.trim().slice(0, 255) || null;
	if (changes.kind !== undefined && isMediaKind(changes.kind)) set.kind = changes.kind;
	if (Object.keys(set).length === 0) return false;
	const updated = await db
		.update(media_items)
		.set(set)
		.where(and(eq(media_items.id, itemId), eq(media_items.profile_id, profileId)))
		.returning({ id: media_items.id });
	return updated.length > 0;
}

/** Drop every rendition of these items that nothing points at. */
export async function pruneUnusedRenditionsOf(itemIds: number[]): Promise<void> {
	if (itemIds.length === 0) return;
	const rows = await db.query.media_renditions.findMany({
		where: inArray(media_renditions.item_id, itemIds),
		columns: { id: true }
	});
	await deleteUnusedRenditions(rows.map((r) => r.id));
}

/** Items as the page reads them, with each original's size. */
export async function listMediaItemViews(profileId: number): Promise<MediaItemView[]> {
	const rows = await db.query.media_items.findMany({
		where: eq(media_items.profile_id, profileId),
		orderBy: [desc(media_items.date_created), desc(media_items.id)],
		with: { file: { columns: { filesize: true } } }
	});
	return rows.map((row) => toItemView(row, row.file?.filesize ?? null));
}

export function toItemView(row: MediaItemRow, bytes: number | null): MediaItemView {
	return {
		id: row.id,
		kind: isMediaKind(row.kind) ? row.kind : 'other',
		label: row.label,
		width: row.width,
		height: row.height,
		format: row.format,
		hasAlpha: row.has_alpha,
		bytes,
		replacesId: row.replaces_id,
		templateId: row.template_id,
		dateCreated: row.date_created?.toISOString() ?? null,
		previewUrl: itemPreviewUrl(row.id),
		originalUrl: `/api/media/items/${row.id}/original`
	};
}

/** The stored size of every original in a profile's library. */
export async function mediaLibraryBytes(profileId: number): Promise<number> {
	const rows = await db.query.media_items.findMany({
		where: eq(media_items.profile_id, profileId),
		columns: { id: true },
		with: { file: { columns: { filesize: true } } }
	});
	return rows.reduce((sum, row) => sum + (row.file?.filesize ?? 0), 0);
}
