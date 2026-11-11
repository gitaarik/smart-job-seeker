/**
 * Slots: the places on a profile that show one picture, pointed at the library.
 *
 * Filling a slot is choosing an item and a crop. The slot gets a free-crop
 * rendition of it (no preset), drawn at once so the public route only ever
 * reads, and the old pointer is let go: the rendition it named is deleted if
 * nothing else uses it. The item stays in the library either way, which is the
 * point of having one.
 */

import { and, eq, sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import { media_items, presentation_template_assets } from '$lib/server/db/schema';
import {
	centredCrop,
	clampCrop,
	entitySlotSpec,
	isThemeMediaSlot,
	renditionUrl,
	slotOutputSize,
	THEME_MEDIA_SLOTS,
	type Crop,
	type MediaSlotSpec,
	type OutputFormat,
	type ThemeMediaSlot
} from '$lib/media-library';
import { deleteUnusedRenditions, ensureRendered, findOrCreateRendition } from './renditions';

/** Where each entity slot lives: the column naming its rendition. */
const ENTITY_SLOT_COLUMNS: Record<string, Record<string, { column: string }>> = {
	profile: { photo: { column: 'profile_photo_id' } },
	work_experience: {
		logo: { column: 'logo_id' },
		banner: { column: 'banner_id' }
	},
	education: {
		logo: { column: 'logo_id' },
		banner: { column: 'banner_id' }
	},
	side_project: {
		logo: { column: 'logo_id' },
		image: { column: 'image_id' },
		banner: { column: 'banner_id' }
	}
};

const ENTITY_TABLES: Record<string, string> = {
	profile: 'profiles',
	work_experience: 'work_experiences',
	education: 'education',
	side_project: 'side_projects'
};

/**
 * The slot names the upload route used to take, before slots were named for
 * what they show rather than the column they wrote. An archive from before the
 * library names its pictures the same way (import-media.ts). The columns
 * themselves were dropped in migration 0091.
 */
const LEGACY_FIELD_NAMES: Record<string, string> = {
	profile_photo_path: 'photo',
	logo_path: 'logo',
	banner_path: 'banner',
	image_path: 'image'
};

export interface EntitySlot {
	entityType: string;
	slot: string;
	table: string;
	column: string;
	spec: MediaSlotSpec;
}

/** The slot an entity type and name refer to, or null when there is none. */
export function resolveEntitySlot(entityType: string, name: string): EntitySlot | null {
	const slot = LEGACY_FIELD_NAMES[name] ?? name;
	const columns = ENTITY_SLOT_COLUMNS[entityType]?.[slot];
	const spec = entitySlotSpec(entityType, slot);
	const table = ENTITY_TABLES[entityType];
	if (!columns || !spec || !table) return null;
	return { entityType, slot, table, ...columns, spec };
}

/** The format a slot draws an item in: PNG where there is transparency to keep. */
export function slotFormat(item: { has_alpha: boolean; format: string }): OutputFormat {
	return item.has_alpha || item.format === 'svg' ? 'png' : 'jpeg';
}

interface SlotState {
	profileId: number;
	renditionId: string | null;
}

async function readSlot(slot: EntitySlot, entityId: number): Promise<SlotState | null> {
	const profileColumn =
		slot.table === 'profiles' ? sql.identifier('id') : sql.identifier('profile_id');
	const rows = await queryRawDirect<{
		profile_id: number;
		rendition_id: string | null;
	}>(sql`
		SELECT ${profileColumn} AS profile_id,
		       ${sql.identifier(slot.column)}::text AS rendition_id
		  FROM ${sql.identifier(slot.table)}
		 WHERE id = ${entityId}
	`);
	const row = rows[0];
	return row ? { profileId: row.profile_id, renditionId: row.rendition_id } : null;
}

async function writeSlot(slot: EntitySlot, entityId: number, renditionId: string | null) {
	const touched = slot.table === 'profiles' ? sql`, date_updated = now()` : sql``;
	await queryRawDirect(sql`
		UPDATE ${sql.identifier(slot.table)}
		   SET ${sql.identifier(slot.column)} = ${renditionId}::uuid${touched}
		 WHERE id = ${entityId}
	`);
}

async function letGo(before: SlotState, keep: string | null) {
	if (before.renditionId && before.renditionId !== keep) {
		await deleteUnusedRenditions([before.renditionId]);
	}
}

export class SlotError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

/** The free-crop rendition a slot shows for an item, drawn and ready. */
export async function slotRendition(
	item: { id: number; width: number; height: number; has_alpha: boolean; format: string },
	spec: MediaSlotSpec,
	crop?: Crop | null
): Promise<string> {
	const clamped = clampCrop(
		crop ?? { x: 0, y: 0, w: item.width, h: item.height },
		item.width,
		item.height
	);
	const size = slotOutputSize(clamped, spec.maxEdge);
	const id = await findOrCreateRendition({
		itemId: item.id,
		presetId: null,
		crop: clamped,
		width: size.width,
		height: size.height,
		format: slotFormat(item)
	});
	await ensureRendered(id);
	return id;
}

/**
 * Show an item in an entity's slot. The caller has checked that the user owns
 * the entity; this checks that the item is from the same profile.
 */
export async function assignEntitySlot(
	slot: EntitySlot,
	entityId: number,
	itemId: number,
	crop?: Crop | null
): Promise<{ renditionId: string; url: string }> {
	const before = await readSlot(slot, entityId);
	if (!before) throw new SlotError('Not found', 404);
	const item = await db.query.media_items.findFirst({
		where: and(eq(media_items.id, itemId), eq(media_items.profile_id, before.profileId))
	});
	if (!item) throw new SlotError("That image is not in this profile's library.", 404);

	const renditionId = await slotRendition(item, slot.spec, crop);
	await writeSlot(slot, entityId, renditionId);
	await letGo(before, renditionId);
	return { renditionId, url: renditionUrl(renditionId)! };
}

/** Empty an entity's slot. The item stays in the library. */
export async function clearEntitySlot(slot: EntitySlot, entityId: number): Promise<void> {
	const before = await readSlot(slot, entityId);
	if (!before) throw new SlotError('Not found', 404);
	await writeSlot(slot, entityId, null);
	await letGo(before, null);
}

/** The profile an entity belongs to, for the library a slot picker should show. */
export async function entityProfileId(slot: EntitySlot, entityId: number): Promise<number | null> {
	return (await readSlot(slot, entityId))?.profileId ?? null;
}

/**
 * Show an item in a portfolio theme's slot. The caller has checked the theme
 * is this profile's and of the portfolio kind.
 */
export async function assignThemeSlot(
	themeId: number,
	profileId: number,
	key: ThemeMediaSlot,
	itemId: number,
	crop?: Crop | null
): Promise<string> {
	return assignTemplateSlot(themeId, profileId, key, THEME_MEDIA_SLOTS[key], itemId, crop);
}

/**
 * Show an item in one asset slot of any presentation template (a theme's
 * images, a banner's logo and background). The caller has checked the
 * template is this profile's.
 */
export async function assignTemplateSlot(
	themeId: number,
	profileId: number,
	key: string,
	spec: MediaSlotSpec,
	itemId: number,
	crop?: Crop | null
): Promise<string> {
	const item = await db.query.media_items.findFirst({
		where: and(eq(media_items.id, itemId), eq(media_items.profile_id, profileId))
	});
	if (!item) throw new SlotError("That image is not in this profile's library.", 404);

	const renditionId = await slotRendition(item, spec, crop);
	const previous = await db.query.presentation_template_assets.findFirst({
		where: and(
			eq(presentation_template_assets.template_id, themeId),
			eq(presentation_template_assets.key, key)
		),
		columns: { rendition_id: true }
	});
	await db
		.insert(presentation_template_assets)
		.values({
			template_id: themeId,
			key,
			file_id: null,
			rendition_id: renditionId,
			date_created: new Date()
		})
		.onConflictDoUpdate({
			target: [presentation_template_assets.template_id, presentation_template_assets.key],
			set: { file_id: null, rendition_id: renditionId, date_created: new Date() }
		});
	// A replaced plain file is left to the orphan reaper, as uploadAsset always
	// did: it may be shared. A replaced rendition is this module's to tidy.
	if (previous?.rendition_id && previous.rendition_id !== renditionId) {
		await deleteUnusedRenditions([previous.rendition_id]);
	}
	return renditionId;
}

/** Empty a theme slot. */
export async function clearThemeSlot(themeId: number, key: string): Promise<void> {
	const removed = await db
		.delete(presentation_template_assets)
		.where(
			and(
				eq(presentation_template_assets.template_id, themeId),
				eq(presentation_template_assets.key, key)
			)
		)
		.returning({ rendition_id: presentation_template_assets.rendition_id });
	const renditionIds = removed.map((r) => r.rendition_id).filter((id): id is string => !!id);
	await deleteUnusedRenditions(renditionIds);
}

/**
 * Show a new version everywhere the old one shows on the profile.
 *
 * Each slot keeps the shape it was cropped to: the new picture gets the
 * largest centred crop of the same aspect, which is the crop a person would
 * start from anyway, and can be refined from the slot. Records of uploads to
 * platforms are left alone: those say what went up, not what should.
 */
export async function replaceInSlots(
	oldItemId: number,
	newItemId: number,
	profileId: number
): Promise<number> {
	const [oldItem, newItem] = await Promise.all([
		db.query.media_items.findFirst({
			where: and(eq(media_items.id, oldItemId), eq(media_items.profile_id, profileId))
		}),
		db.query.media_items.findFirst({
			where: and(eq(media_items.id, newItemId), eq(media_items.profile_id, profileId))
		})
	]);
	if (!oldItem || !newItem) return 0;

	const rows = await queryRawDirect<{ id: string; crop_w: number; crop_h: number }>(sql`
		SELECT id::text AS id, crop_w, crop_h FROM media_renditions WHERE item_id = ${oldItem.id}
	`);
	let moved = 0;
	for (const rendition of rows) {
		const crop = centredCrop(newItem.width, newItem.height, rendition.crop_w / rendition.crop_h);
		for (const [entityType, slots] of Object.entries(ENTITY_SLOT_COLUMNS)) {
			for (const [name, columns] of Object.entries(slots)) {
				const slot = resolveEntitySlot(entityType, name);
				if (!slot) continue;
				const holders = await queryRawDirect<{ id: number }>(sql`
					SELECT id FROM ${sql.identifier(ENTITY_TABLES[entityType])}
					 WHERE ${sql.identifier(columns.column)} = ${rendition.id}::uuid
				`);
				for (const holder of holders) {
					await assignEntitySlot(slot, holder.id, newItem.id, crop);
					moved++;
				}
			}
		}
		const themeSlots = await db.query.presentation_template_assets.findMany({
			where: eq(presentation_template_assets.rendition_id, rendition.id),
			columns: { template_id: true, key: true }
		});
		for (const asset of themeSlots) {
			if (!isThemeMediaSlot(asset.key)) continue;
			await assignThemeSlot(asset.template_id, profileId, asset.key, newItem.id, crop);
			moved++;
		}
	}
	return moved;
}
