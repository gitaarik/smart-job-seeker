/**
 * Where a profile's pictures are used: which slots show a rendition of each
 * item, and which platforms an application records it as uploaded to.
 *
 * The page asks this before deleting an item, so the person sees what will go
 * blank, and to say "in use" on the grid. Every slot is listed by name here;
 * the test in __tests__/references.test.ts keeps that list in step with the
 * foreign keys, so a new slot cannot be shown nowhere.
 */

import { sql } from 'drizzle-orm';
import { queryRawDirect } from '$lib/server/db';

export interface MediaUse {
	itemId: number;
	renditionId: string;
	/** profile | work_experience | education | side_project | theme | application */
	kind: string;
	/** Where it shows, in words: "Profile photo", "Logo of Citrus". */
	label: string;
	href: string;
	/** True for a record of an upload elsewhere, false for a slot on the profile. */
	record: boolean;
	/** For a record, when it went up. */
	dateUploaded: string | null;
}

interface UseRow {
	item_id: number;
	rendition_id: string;
	kind: string;
	entity_id: number;
	name: string | null;
	slot: string;
	date_uploaded: string | null;
}

const SLOT_WORDS: Record<string, string> = {
	photo: 'Profile photo',
	logo: 'Logo',
	banner: 'Banner',
	image: 'Image'
};

/** Every use of every item of a profile, or of the given items only. */
export async function mediaUsage(profileId: number, itemIds?: number[]): Promise<MediaUse[]> {
	if (itemIds && itemIds.length === 0) return [];
	const itemFilter = itemIds
		? sql`AND i.id IN (${sql.join(
				itemIds.map((id) => sql`${id}`),
				sql`, `
			)})`
		: sql``;

	const rows = await queryRawDirect<UseRow>(sql`
		WITH r AS (
			SELECT r.id, r.item_id
			  FROM media_renditions r
			  JOIN media_items i ON i.id = r.item_id
			 WHERE i.profile_id = ${profileId} ${itemFilter}
		)
		SELECT r.item_id, r.id::text AS rendition_id, 'profile' AS kind, p.id AS entity_id,
		       p.name::text AS name, 'photo' AS slot, NULL::text AS date_uploaded
		  FROM r JOIN profiles p ON p.profile_photo_id = r.id
		UNION ALL
		SELECT r.item_id, r.id::text, 'work_experience', w.id, w.name::text, 'logo', NULL
		  FROM r JOIN work_experiences w ON w.logo_id = r.id
		UNION ALL
		SELECT r.item_id, r.id::text, 'work_experience', w.id, w.name::text, 'banner', NULL
		  FROM r JOIN work_experiences w ON w.banner_id = r.id
		UNION ALL
		SELECT r.item_id, r.id::text, 'education', e.id, e.institution::text, 'logo', NULL
		  FROM r JOIN education e ON e.logo_id = r.id
		UNION ALL
		SELECT r.item_id, r.id::text, 'education', e.id, e.institution::text, 'banner', NULL
		  FROM r JOIN education e ON e.banner_id = r.id
		UNION ALL
		SELECT r.item_id, r.id::text, 'side_project', s.id, s.name::text, 'image', NULL
		  FROM r JOIN side_projects s ON s.image_id = r.id
		UNION ALL
		SELECT r.item_id, r.id::text, 'side_project', s.id, s.name::text, 'banner', NULL
		  FROM r JOIN side_projects s ON s.banner_id = r.id
		UNION ALL
		SELECT r.item_id, r.id::text, 'theme', t.id, t.name::text, a.key::text, NULL
		  FROM r
		  JOIN presentation_template_assets a ON a.rendition_id = r.id
		  JOIN presentation_templates t ON t.id = a.template_id
		UNION ALL
		SELECT r.item_id, r.id::text, 'application', ap.id,
		       COALESCE(NULLIF(j.company, ''), j.title)::text, 'upload', am.date_uploaded::text
		  FROM r
		  JOIN application_media am ON am.rendition_id = r.id
		  JOIN applications ap ON ap.id = am.application_id
		  LEFT JOIN jobs j ON j.id = ap.job_id
	`);

	return rows.map((row) => describe(row));
}

function describe(row: UseRow): MediaUse {
	const base = {
		itemId: row.item_id,
		renditionId: row.rendition_id,
		kind: row.kind,
		record: false,
		dateUploaded: null
	};
	const name = row.name?.trim() || 'Untitled';
	switch (row.kind) {
		case 'profile':
			return { ...base, label: 'Profile photo', href: '/profile/edit' };
		case 'work_experience':
			return {
				...base,
				label: `${SLOT_WORDS[row.slot] ?? row.slot} of ${name}`,
				href: `/profile/work-experience/${row.entity_id}`
			};
		case 'education':
			return {
				...base,
				label: `${SLOT_WORDS[row.slot] ?? row.slot} of ${name}`,
				href: `/profile/education/${row.entity_id}`
			};
		case 'side_project':
			return {
				...base,
				label: `${SLOT_WORDS[row.slot] ?? row.slot} of ${name}`,
				href: `/profile/side-projects/${row.entity_id}`
			};
		case 'theme':
			return { ...base, label: `${row.slot} on the "${name}" theme`, href: '/profile/portfolio' };
		default:
			return {
				...base,
				label: `Uploaded to ${name}`,
				href: `/applications/${row.entity_id}`,
				record: true,
				dateUploaded: row.date_uploaded
			};
	}
}

/** The uses grouped by item. */
export function usesByItem(uses: MediaUse[]): Map<number, MediaUse[]> {
	const grouped = new Map<number, MediaUse[]>();
	for (const use of uses) {
		const list = grouped.get(use.itemId) ?? [];
		list.push(use);
		grouped.set(use.itemId, list);
	}
	return grouped;
}
