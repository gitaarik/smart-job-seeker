/**
 * Handing media library bytes to a browser: publicly, or to their owner.
 *
 * Public is `/assets/<rendition id>`, and only while a public slot points at
 * the rendition (references.ts). Everything else, the originals included, is
 * served only to the user whose profile owns it, through `/api/media/...`.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { and, eq, sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import { media_items, media_renditions, profiles } from '$lib/server/db/schema';
import { getFile } from '$lib/server/files';
import { publicRenditionCondition } from './references';
import { ensureRendered, type RenderedRendition } from './renditions';
import { renderPreview } from './render';
import type { StoredFormat } from './originals';

const FILES_DIR = join(process.cwd(), 'uploads', 'files');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ServedImage {
	bytes: Buffer;
	type: string;
	rendition: RenderedRendition;
}

async function bytesOf(rendition: RenderedRendition): Promise<ServedImage> {
	return {
		bytes: await readFile(join(FILES_DIR, rendition.filenameDisk)),
		type: rendition.type,
		rendition
	};
}

/**
 * A rendition anyone may fetch, or null. Null covers "no such rendition" and
 * "not public" alike, so the route cannot tell a prober which one it was.
 */
export async function publicRendition(id: string): Promise<ServedImage | null> {
	if (!UUID_RE.test(id)) return null;
	const rows = await queryRawDirect<{ is_public: boolean }>(sql`
		SELECT ${publicRenditionCondition(sql`r.id`)} AS is_public
		  FROM media_renditions r
		 WHERE r.id = ${id}::uuid
	`);
	if (!rows[0]) return null;
	if (!rows[0].is_public) {
		console.warn(`[assets] refused non-public rendition ${id}`);
		return null;
	}
	const rendered = await ensureRendered(id);
	return rendered ? bytesOf(rendered) : null;
}

/** An item, when its profile belongs to this user. */
export async function ownedItem(itemId: number, userId: string) {
	const rows = await db
		.select({ item: media_items })
		.from(media_items)
		.innerJoin(profiles, eq(profiles.id, media_items.profile_id))
		.where(and(eq(media_items.id, itemId), eq(profiles.user_id, userId)))
		.limit(1);
	return rows[0]?.item ?? null;
}

/** A rendition and its item, when the item's profile belongs to this user. */
export async function ownedRendition(id: string, userId: string) {
	if (!UUID_RE.test(id)) return null;
	const rows = await db
		.select({ rendition: media_renditions, item: media_items })
		.from(media_renditions)
		.innerJoin(media_items, eq(media_items.id, media_renditions.item_id))
		.innerJoin(profiles, eq(profiles.id, media_items.profile_id))
		.where(and(eq(media_renditions.id, id), eq(profiles.user_id, userId)))
		.limit(1);
	return rows[0] ?? null;
}

/** The bytes of a rendition its owner asked for, drawn first if need be. */
export async function renditionBytes(id: string): Promise<ServedImage | null> {
	const rendered = await ensureRendered(id);
	return rendered ? bytesOf(rendered) : null;
}

/** The longest preview edge the page may ask for. */
export const MAX_PREVIEW_EDGE = 1600;

/** An upright, scaled-down WebP of an item's original, for its owner's page. */
export async function itemPreview(
	item: typeof media_items.$inferSelect,
	maxEdge: number
): Promise<Buffer> {
	const original = await getFile(item.file_id);
	return renderPreview(
		{
			original,
			format: item.format as StoredFormat,
			orientation: item.orientation,
			width: item.width,
			height: item.height
		},
		Math.max(64, Math.min(MAX_PREVIEW_EDGE, maxEdge))
	);
}

/** The original's bytes, exactly as stored. */
export async function itemOriginal(item: typeof media_items.$inferSelect): Promise<Buffer> {
	return getFile(item.file_id);
}
