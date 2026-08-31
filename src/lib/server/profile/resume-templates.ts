/**
 * Server-side loading of per-profile resume/CV templates.
 *
 * A template's artwork lives in `resume_template_assets`, one row per slot,
 * and is folded back into `config` here. That fold is the whole reason the
 * normalization cost nothing downstream: the renderer, the thumbnail strip and
 * the export all still read `config.assets.badge` and `config.thumbnail`, and
 * none of them had to learn where the ids actually come from.
 *
 * Rows win over anything still in the jsonb. A config written before the move
 * may carry both, and the table is the one with a foreign key.
 */

import { dbDirect as db } from '$lib/server/db';
import { eq, and, asc } from 'drizzle-orm';
import { resume_templates } from '$lib/server/db/schema';
import type {
	ResumeTemplate,
	ResumeTemplateAssets,
	ResumeTemplateConfig
} from '$lib/resume-templates';

/** The asset rows as the config keys they used to be. */
export function foldAssetsIntoConfig(
	config: ResumeTemplateConfig,
	rows: { key: string; file_id: string }[]
): ResumeTemplateConfig {
	if (rows.length === 0) return config;

	const assets: Record<string, string> = {};
	let thumbnail: string | undefined;
	for (const row of rows) {
		if (row.key === 'thumbnail') thumbnail = row.file_id;
		else assets[row.key] = row.file_id;
	}

	const folded: ResumeTemplateConfig = { ...config };
	if (Object.keys(assets).length > 0) {
		folded.assets = { ...(config.assets ?? {}), ...assets } as ResumeTemplateAssets;
	}
	if (thumbnail) folded.thumbnail = thumbnail;
	return folded;
}

function toTemplate(r: {
	id: number;
	name: string;
	slug: string;
	config: unknown;
	resume_template_assets?: { key: string; file_id: string }[];
}): ResumeTemplate {
	return {
		id: r.id,
		name: r.name,
		slug: r.slug,
		config: foldAssetsIntoConfig(
			(r.config ?? {}) as ResumeTemplateConfig,
			r.resume_template_assets ?? []
		)
	};
}

/** Every template read here needs its artwork; there is no reader that does not. */
const withAssets = {
	resume_template_assets: { columns: { key: true, file_id: true } }
} as const;

/** All published templates for a profile, in sort order. */
export async function getResumeTemplatesForProfile(profileId: number): Promise<ResumeTemplate[]> {
	const rows = await db.query.resume_templates.findMany({
		where: and(
			eq(resume_templates.profile_id, profileId),
			eq(resume_templates.status, 'published')
		),
		orderBy: asc(resume_templates.sort),
		with: withAssets
	});
	return rows.map(toTemplate);
}

/** A single published template by slug, or null. */
export async function getResumeTemplate(
	profileId: number,
	slug: string
): Promise<ResumeTemplate | null> {
	const row = await db.query.resume_templates.findFirst({
		where: and(
			eq(resume_templates.profile_id, profileId),
			eq(resume_templates.slug, slug),
			eq(resume_templates.status, 'published')
		),
		with: withAssets
	});
	return row ? toTemplate(row) : null;
}

/**
 * Whether a template id belongs to this profile.
 *
 * Write paths take the template id from the client, so every one of them has to
 * confirm it before storing anything against it — the same reason
 * `isEntityOwned` exists for translations. Unlike the read helpers above this
 * does not require `published`: a draft template is still yours to configure.
 */
export async function isTemplateOwned(profileId: number, templateId: number): Promise<boolean> {
	const row = await db.query.resume_templates.findFirst({
		columns: { id: true },
		where: and(eq(resume_templates.id, templateId), eq(resume_templates.profile_id, profileId))
	});
	return !!row;
}
