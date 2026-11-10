/**
 * Who points at a rendition, and which of those make it public.
 *
 * Two questions, answered from two different places on purpose:
 *
 * - **Is it in use?** Asked before a rendition is deleted. The answer is
 *   every foreign key to `media_renditions`, read from the schema itself, so a
 *   column added next year is counted without anyone remembering this file.
 *   That is the lesson of the orphan sweep of 2026-08-23, which trusted a
 *   hand-kept list and deleted the Citrus template's artwork.
 * - **Is it public?** Asked by `/assets/[id]` on every request it cannot
 *   answer from a file. That one is an allowlist, written down, for the reason
 *   that route gives: forgetting a public slot costs an image that does not
 *   load, which someone notices; forgetting a private reference serves a
 *   private picture for a year, which nobody does.
 *
 * The test in `__tests__/references.test.ts` holds the two together: every
 * foreign key the schema has must be in exactly one of the two lists below,
 * so a new reference fails CI until someone decides which it is.
 */

import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { is, sql, type SQL } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';

export interface RenditionReference {
	table: string;
	column: string;
}

/** Slots whose rendition anyone may fetch, by its unguessable id. */
export const PUBLIC_RENDITION_REFERENCES = [
	'profiles.profile_photo_id',
	'work_experiences.logo_id',
	'work_experiences.banner_id',
	'education.logo_id',
	'education.banner_id',
	'side_projects.image_id',
	'side_projects.banner_id',
	'side_projects.logo_id',
	'presentation_template_assets.rendition_id'
] as const;

/**
 * References that record a rendition without publishing it. A picture that
 * was only downloaded for a platform stays private and is served to its owner.
 */
export const PRIVATE_RENDITION_REFERENCES = ['application_media.rendition_id'] as const;

let cached: RenditionReference[] | null = null;

/** Every foreign key to `media_renditions`, as `table.column`. */
export function renditionReferences(): RenditionReference[] {
	if (cached) return cached;
	const found: RenditionReference[] = [];
	for (const value of Object.values(schema)) {
		if (!is(value, PgTable)) continue;
		const config = getTableConfig(value);
		for (const fk of config.foreignKeys) {
			const reference = fk.reference();
			if (getTableConfig(reference.foreignTable).name !== 'media_renditions') continue;
			for (const column of reference.columns) {
				found.push({ table: config.name, column: column.name });
			}
		}
	}
	found.sort((a, b) => `${a.table}.${a.column}`.localeCompare(`${b.table}.${b.column}`));
	cached = found;
	return found;
}

function existsIn(reference: string, id: SQL): SQL {
	const [table, column] = reference.split('.');
	return sql`EXISTS (SELECT 1 FROM ${sql.identifier(table)} WHERE ${sql.identifier(column)} = ${id})`;
}

/** True while a public slot points at the rendition whose id is `id`. */
export function publicRenditionCondition(id: SQL): SQL {
	return sql`(${sql.join(
		PUBLIC_RENDITION_REFERENCES.map((ref) => existsIn(ref, id)),
		sql` OR `
	)})`;
}

/** True while anything at all points at the rendition whose id is `id`. */
export function renditionInUseCondition(id: SQL): SQL {
	return sql`(${sql.join(
		renditionReferences().map((ref) => existsIn(`${ref.table}.${ref.column}`, id)),
		sql` OR `
	)})`;
}
