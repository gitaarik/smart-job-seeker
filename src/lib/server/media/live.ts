/**
 * Where each version of a picture is live.
 *
 * Platforms are applications in SJS on purpose (signing up is applying), so
 * "LinkedIn shows my 2025 photo" is a row on the LinkedIn application:
 * `application_media`, a rendition and the day it went up. The newest row for
 * a preset is what that platform shows. When the item behind it has since been
 * replaced by a new version (`media_items.replaces_id`), the platform is still
 * showing the old one, and the media page lists it.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import {
	application_media,
	applications,
	media_items,
	media_presets,
	media_renditions
} from '$lib/server/db/schema';
import { presetName } from '$lib/media-library';

export interface StalePlatform {
	applicationId: number;
	/** The platform, as the application names it. */
	platform: string;
	/** "LinkedIn background", or the item's label for a free crop. */
	slot: string;
	renditionId: string;
	itemId: number;
	itemLabel: string | null;
	dateUploaded: string;
	/** The newest version of the picture, to put up instead. */
	newestItemId: number;
	newestLabel: string | null;
}

/** The newest version each item has become, following `replaces_id` forward. */
export function newestVersions(
	items: { id: number; replacesId: number | null }[]
): Map<number, number> {
	const replacedBy = new Map<number, number>();
	for (const item of items) {
		// Two new versions of one item: the later one (higher id) wins.
		if (item.replacesId !== null) {
			const current = replacedBy.get(item.replacesId);
			if (current === undefined || item.id > current) replacedBy.set(item.replacesId, item.id);
		}
	}
	const newest = new Map<number, number>();
	for (const item of items) {
		let at = item.id;
		const seen = new Set<number>([at]);
		while (replacedBy.has(at)) {
			const next = replacedBy.get(at)!;
			if (seen.has(next)) break; // a cycle the schema allows and nothing makes
			seen.add(next);
			at = next;
		}
		newest.set(item.id, at);
	}
	return newest;
}

interface LatestRow {
	application_id: number;
	rendition_id: string;
	date_uploaded: string;
	item_id: number;
	label: string | null;
	platform: string | null;
	preset_platform: string | null;
	preset_slot: string | null;
}

/** Applications whose platform still shows a picture that has a newer version. */
export async function stalePlatforms(profileId: number): Promise<StalePlatform[]> {
	const latest = await queryRawDirect<LatestRow>(sql`
		SELECT DISTINCT ON (am.application_id, COALESCE(r.preset_id::text, 'item ' || r.item_id))
		       am.application_id, am.rendition_id::text AS rendition_id,
		       am.date_uploaded::text AS date_uploaded, r.item_id, i.label,
		       COALESCE(NULLIF(j.company, ''), j.title)::text AS platform,
		       p.platform AS preset_platform, p.slot AS preset_slot
		  FROM application_media am
		  JOIN applications a ON a.id = am.application_id
		  JOIN media_renditions r ON r.id = am.rendition_id
		  JOIN media_items i ON i.id = r.item_id
		  LEFT JOIN media_presets p ON p.id = r.preset_id
		  LEFT JOIN jobs j ON j.id = a.job_id
		 WHERE a.profile_id = ${profileId}
		 ORDER BY am.application_id, COALESCE(r.preset_id::text, 'item ' || r.item_id),
		          am.date_uploaded DESC, am.id DESC
	`);
	if (latest.length === 0) return [];

	const items = await db.query.media_items.findMany({
		where: eq(media_items.profile_id, profileId),
		columns: { id: true, replaces_id: true, label: true }
	});
	const newest = newestVersions(items.map((i) => ({ id: i.id, replacesId: i.replaces_id })));
	const labels = new Map(items.map((i) => [i.id, i.label]));

	return latest
		.filter((row) => (newest.get(row.item_id) ?? row.item_id) !== row.item_id)
		.map((row) => {
			const newestItemId = newest.get(row.item_id)!;
			return {
				applicationId: row.application_id,
				platform: row.platform?.trim() || `Application ${row.application_id}`,
				slot:
					row.preset_platform && row.preset_slot
						? presetName({ platform: row.preset_platform, slot: row.preset_slot })
						: (row.label ?? 'Picture'),
				renditionId: row.rendition_id,
				itemId: row.item_id,
				itemLabel: row.label,
				dateUploaded: row.date_uploaded,
				newestItemId,
				newestLabel: labels.get(newestItemId) ?? null
			};
		});
}

export interface ApplicationMediaRecord {
	id: number;
	renditionId: string;
	itemId: number;
	itemLabel: string | null;
	presetName: string | null;
	width: number;
	height: number;
	dateUploaded: string;
	/** A newer version of the picture exists. */
	stale: boolean;
	newestItemId: number;
}

/** What an application records as uploaded to its platform, newest first. */
export async function applicationMediaRecords(
	applicationId: number,
	profileId: number
): Promise<ApplicationMediaRecord[]> {
	const rows = await db
		.select({
			id: application_media.id,
			renditionId: application_media.rendition_id,
			dateUploaded: application_media.date_uploaded,
			itemId: media_renditions.item_id,
			width: media_renditions.width,
			height: media_renditions.height,
			label: media_items.label,
			presetPlatform: media_presets.platform,
			presetSlot: media_presets.slot
		})
		.from(application_media)
		.innerJoin(applications, eq(applications.id, application_media.application_id))
		.innerJoin(media_renditions, eq(media_renditions.id, application_media.rendition_id))
		.innerJoin(media_items, eq(media_items.id, media_renditions.item_id))
		.leftJoin(media_presets, eq(media_presets.id, media_renditions.preset_id))
		.where(
			and(
				eq(application_media.application_id, applicationId),
				eq(applications.profile_id, profileId)
			)
		)
		.orderBy(desc(application_media.date_uploaded), desc(application_media.id));
	if (rows.length === 0) return [];

	const items = await db.query.media_items.findMany({
		where: eq(media_items.profile_id, profileId),
		columns: { id: true, replaces_id: true }
	});
	const newest = newestVersions(items.map((i) => ({ id: i.id, replacesId: i.replaces_id })));

	return rows.map((row) => {
		const newestItemId = newest.get(row.itemId) ?? row.itemId;
		return {
			id: row.id,
			renditionId: row.renditionId,
			itemId: row.itemId,
			itemLabel: row.label,
			presetName:
				row.presetPlatform && row.presetSlot
					? presetName({ platform: row.presetPlatform, slot: row.presetSlot })
					: null,
			width: row.width,
			height: row.height,
			dateUploaded: row.dateUploaded,
			stale: newestItemId !== row.itemId,
			newestItemId
		};
	});
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Record that a rendition went up on an application's platform. Both must be
 * this profile's. Returns what is wrong, or null.
 */
export async function recordUpload(
	profileId: number,
	applicationId: number,
	renditionId: string,
	dateUploaded: string
): Promise<string | null> {
	const application = await db.query.applications.findFirst({
		where: and(eq(applications.id, applicationId), eq(applications.profile_id, profileId)),
		columns: { id: true }
	});
	if (!application) return 'Choose one of your applications.';
	const owned = await db
		.select({ id: media_renditions.id })
		.from(media_renditions)
		.innerJoin(media_items, eq(media_items.id, media_renditions.item_id))
		.where(and(eq(media_renditions.id, renditionId), eq(media_items.profile_id, profileId)))
		.limit(1);
	if (!owned[0]) return 'Save a crop first, then record where it went up.';
	const date = ISO_DATE.test(dateUploaded) ? dateUploaded : new Date().toISOString().slice(0, 10);
	await db.insert(application_media).values({
		application_id: application.id,
		rendition_id: renditionId,
		date_uploaded: date,
		date_created: new Date()
	});
	return null;
}

/** Forget a record of an upload. */
export async function removeUploadRecord(profileId: number, recordId: number): Promise<boolean> {
	const owned = await db
		.select({ id: application_media.id })
		.from(application_media)
		.innerJoin(applications, eq(applications.id, application_media.application_id))
		.where(and(eq(application_media.id, recordId), eq(applications.profile_id, profileId)))
		.limit(1);
	if (!owned[0]) return false;
	await db.delete(application_media).where(eq(application_media.id, recordId));
	return true;
}
