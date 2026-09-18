/**
 * Server-side loading of per-profile presentation templates, shared by both
 * kinds.
 *
 * A template's artwork lives in `presentation_template_assets`, one row per
 * slot, and is folded back into `config` here. That fold is the whole reason
 * the normalization cost nothing downstream: the renderer, the thumbnail strip
 * and the export all still read `config.assets.badge` and `config.thumbnail`,
 * and none of them had to learn where the ids actually come from.
 *
 * Rows win over anything still in the jsonb. A config written before the move
 * may carry both, and the table is the one with a foreign key.
 *
 * Nothing here is exported to route code. The per-kind modules
 * (`resume-templates.ts`, `portfolio-themes.ts`) each pin their own `kind` and
 * are the only way in, so a caller cannot forget the filter and pull a
 * portfolio theme into the CV template switcher.
 */

import { dbDirect as db } from '$lib/server/db';
import { eq, and, asc } from 'drizzle-orm';
import { presentation_templates } from '$lib/server/db/schema';
import type { TemplateKind } from '$lib/presentation-templates';

/** A row as the loaders see it, before its config is narrowed to a kind. */
export interface LoadedTemplate<TConfig> {
	id: number;
	name: string;
	slug: string;
	config: TConfig;
}

interface TemplateRow {
	id: number;
	name: string;
	slug: string;
	config: unknown;
	presentation_template_assets?: { key: string; file_id: string }[];
}

/** The asset rows as the config keys they used to be. */
export function foldAssetsIntoConfig<TConfig extends object>(
	config: TConfig,
	rows: { key: string; file_id: string }[]
): TConfig {
	if (rows.length === 0) return config;

	const assets: Record<string, string> = {};
	let thumbnail: string | undefined;
	for (const row of rows) {
		if (row.key === 'thumbnail') thumbnail = row.file_id;
		else assets[row.key] = row.file_id;
	}

	const folded = { ...config } as TConfig & { assets?: object; thumbnail?: string };
	if (Object.keys(assets).length > 0) {
		folded.assets = { ...(folded.assets ?? {}), ...assets };
	}
	if (thumbnail) folded.thumbnail = thumbnail;
	return folded;
}

function toTemplate<TConfig extends object>(r: TemplateRow): LoadedTemplate<TConfig> {
	return {
		id: r.id,
		name: r.name,
		slug: r.slug,
		config: foldAssetsIntoConfig((r.config ?? {}) as TConfig, r.presentation_template_assets ?? [])
	};
}

/** Every template read here needs its artwork; there is no reader that does not. */
const withAssets = {
	presentation_template_assets: { columns: { key: true, file_id: true } }
} as const;

/** All published templates of one kind for a profile, in sort order. */
export async function loadTemplatesOfKind<TConfig extends object>(
	profileId: number,
	kind: TemplateKind
): Promise<LoadedTemplate<TConfig>[]> {
	const rows = await db.query.presentation_templates.findMany({
		where: and(
			eq(presentation_templates.profile_id, profileId),
			eq(presentation_templates.kind, kind),
			eq(presentation_templates.status, 'published')
		),
		orderBy: asc(presentation_templates.sort),
		with: withAssets
	});
	return rows.map((r) => toTemplate<TConfig>(r));
}

/** A single published template of one kind by slug, or null. */
export async function loadTemplateOfKind<TConfig extends object>(
	profileId: number,
	kind: TemplateKind,
	slug: string
): Promise<LoadedTemplate<TConfig> | null> {
	const row = await db.query.presentation_templates.findFirst({
		where: and(
			eq(presentation_templates.profile_id, profileId),
			eq(presentation_templates.kind, kind),
			eq(presentation_templates.slug, slug),
			eq(presentation_templates.status, 'published')
		),
		with: withAssets
	});
	return row ? toTemplate<TConfig>(row) : null;
}

/**
 * One published template of a kind, by id.
 *
 * By id because the publish pointers on `profiles` are foreign keys: a slug
 * identifies a row only together with a kind, and a pointer that could resolve
 * to a CV template is worse than one the database refuses.
 */
export async function loadTemplateOfKindById<TConfig extends object>(
	profileId: number,
	kind: TemplateKind,
	templateId: number
): Promise<LoadedTemplate<TConfig> | null> {
	const row = await db.query.presentation_templates.findFirst({
		where: and(
			eq(presentation_templates.id, templateId),
			eq(presentation_templates.profile_id, profileId),
			eq(presentation_templates.kind, kind),
			eq(presentation_templates.status, 'published')
		),
		with: withAssets
	});
	return row ? toTemplate<TConfig>(row) : null;
}

/**
 * Whether a template id belongs to this profile, and is of the kind the caller
 * means.
 *
 * Write paths take the template id from the client, so every one of them has to
 * confirm it before storing anything against it — the same reason
 * `isEntityOwned` exists for translations. Unlike the read helpers above this
 * does not require `published`: a draft template is still yours to configure.
 *
 * The `kind` check is part of ownership here for the same reason the reads pin
 * it: an id is enough to reach any row in the table, so a write path that only
 * asked "is it mine" would happily attach a CV field override to a portfolio
 * theme.
 */
export async function isTemplateOwnedOfKind(
	profileId: number,
	kind: TemplateKind,
	templateId: number
): Promise<boolean> {
	const row = await db.query.presentation_templates.findFirst({
		columns: { id: true },
		where: and(
			eq(presentation_templates.id, templateId),
			eq(presentation_templates.kind, kind),
			eq(presentation_templates.profile_id, profileId)
		)
	});
	return !!row;
}
