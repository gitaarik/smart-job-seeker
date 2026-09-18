/**
 * Restore a profile's presentation templates, of both kinds.
 *
 * Assets are re-uploaded, which mints new file ids, so the config's references
 * have to be rewritten. The rewrite is a string substitution over the
 * serialised config: file ids are UUIDs, unique enough that swapping them
 * wherever they appear is safe and does not depend on knowing which keys hold
 * them.
 *
 * A template whose assets are missing from the archive still imports — it keeps
 * its original ids and renders without those images, which beats losing the
 * layout, fonts and colours too.
 *
 * The rewritten ids are then lifted out of the config into
 * `presentation_template_assets`, where they live now. This happens on import
 * rather than in the archive format because an archive written before that table
 * existed has to import into it too: the file still carries the ids in the
 * config, and this is the one place that turns them into rows. Whatever is not
 * recognised as an asset stays in the config untouched.
 */

import { dbDirect } from '$lib/server/db';
import { eq, inArray } from 'drizzle-orm';
import { files, presentation_template_assets, presentation_templates } from '$lib/server/db/schema';
import { uploadFile } from '$lib/server/files';
import type { ExportedResumeTemplate } from './types';
import type { ResumeTemplateConfig } from '$lib/resume-templates';
import { DEFAULT_TEMPLATE_KIND, isTemplateKind } from '$lib/presentation-templates';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Unambiguous key for the (kind, slug) uniqueness the table enforces. */
const slugKey = (kind: string, slug: string) => JSON.stringify([kind, slug]);

/**
 * The asset slots a config names, as `{ key, fileId }`, and the config without
 * them.
 *
 * Only the two shapes the format has ever used are read: `config.assets.*` and
 * the top-level `thumbnail`. This is deliberately narrower than the export's
 * walk-anything-uuid-shaped rule — that rule exists so an unknown key still
 * *travels*, and a value this does not recognise is left in the config, where
 * it stays exportable and does no harm.
 */
export function splitConfigAssets(config: unknown): {
	config: unknown;
	assets: { key: string; fileId: string }[];
} {
	if (!config || typeof config !== 'object' || Array.isArray(config)) return { config, assets: [] };

	const rest = { ...(config as ResumeTemplateConfig) };
	const assets: { key: string; fileId: string }[] = [];

	if (typeof rest.thumbnail === 'string' && UUID_RE.test(rest.thumbnail)) {
		assets.push({ key: 'thumbnail', fileId: rest.thumbnail });
		delete rest.thumbnail;
	}

	if (rest.assets && typeof rest.assets === 'object' && !Array.isArray(rest.assets)) {
		const remaining: Record<string, string> = {};
		for (const [key, value] of Object.entries(rest.assets as Record<string, unknown>)) {
			if (typeof value === 'string' && UUID_RE.test(value) && key !== 'thumbnail') {
				assets.push({ key, fileId: value });
			} else if (typeof value === 'string') {
				remaining[key] = value;
			}
		}
		if (Object.keys(remaining).length > 0) rest.assets = remaining;
		else delete rest.assets;
	}

	return { config: rest, assets };
}

/** Replace each old file id with its new one throughout the config. */
export function rewriteConfigFileIds(config: unknown, idMap: Map<string, string>): unknown {
	if (idMap.size === 0 || config === null || config === undefined) return config;

	let serialised = JSON.stringify(config);
	for (const [oldId, newId] of idMap) {
		serialised = serialised.split(oldId).join(newId);
	}
	return JSON.parse(serialised);
}

export async function importResumeTemplates(
	profileId: number,
	templates: ExportedResumeTemplate[],
	assetBuffers: Map<string, Buffer>
): Promise<{ imported: number; assetsRestored: number }> {
	const now = new Date();
	let imported = 0;
	let assetsRestored = 0;

	// (kind, slug) is unique per profile since migration 0044, and this import
	// is not always preceded by a delete: only an overwrite clears the existing
	// templates first, so a merge lands next to whatever is already there. Two
	// rows wanting one slug used to be allowed and merely ambiguous — the slug
	// lookup is a `findFirst` — and would now abort the whole import on a
	// constraint violation. Rather than refuse, take the next free slug, which
	// is what the rest of this file does with every other missing or unusable
	// field.
	const taken = new Set(
		(
			await dbDirect.query.presentation_templates.findMany({
				where: eq(presentation_templates.profile_id, profileId),
				columns: { kind: true, slug: true }
			})
		).map((r) => slugKey(r.kind, r.slug))
	);

	function claimSlug(kind: string, wanted: string): string {
		let slug = wanted;
		for (let n = 2; taken.has(slugKey(kind, slug)); n++) slug = `${wanted}-${n}`;
		taken.add(slugKey(kind, slug));
		return slug;
	}

	for (const template of templates) {
		const idMap = new Map<string, string>();

		for (const asset of template.assets ?? []) {
			const buffer = assetBuffers.get(asset.archivePath);
			if (!buffer) {
				console.warn(`[Import] Template asset missing from archive: ${asset.archivePath}`);
				continue;
			}

			try {
				const uploaded = await uploadFile({
					buffer,
					filename: asset.filename,
					title: asset.filename
				});
				idMap.set(asset.file_id, uploaded.id);
				assetsRestored++;
			} catch (error) {
				console.warn(`[Import] Could not restore template asset ${asset.filename}:`, error);
			}
		}

		// name and slug are NOT NULL; fall back rather than refuse the import.
		const name = template.name?.trim() || 'Imported template';
		const wantedSlug =
			template.slug?.trim() ||
			name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/(^-|-$)/g, '') ||
			'imported-template';

		const { config, assets } = splitConfigAssets(rewriteConfigFileIds(template.config, idMap));

		// An archive written before the kinds split carries no `kind`, and
		// everything in one is a CV template — which is what the column
		// defaults to. An unrecognised value is treated the same way rather
		// than stored: the unique key is (profile, kind, slug), so a typo here
		// would quietly create a template nothing can ever look up.
		const declaredKind = template.kind ?? '';
		const kind = isTemplateKind(declaredKind) ? declaredKind : DEFAULT_TEMPLATE_KIND;
		const slug = claimSlug(kind, wantedSlug);

		const [row] = await dbDirect
			.insert(presentation_templates)
			.values({
				profile_id: profileId,
				name,
				slug,
				kind,
				status: template.status || 'draft',
				sort: template.sort ?? null,
				config,
				date_created: now,
				date_updated: now
			})
			.returning({ id: presentation_templates.id });

		// `file_id` is a real foreign key, so an id the archive named but never
		// restored (a missing asset, or an export from an instance whose file
		// store had already lost it) would fail the insert and take the whole
		// template with it. Only ids that exist become rows; the rest are dropped,
		// which is what a broken reference was already worth.
		if (assets.length > 0) {
			const known = new Set(
				(
					await dbDirect.query.files.findMany({
						where: inArray(
							files.id,
							assets.map((a) => a.fileId)
						),
						columns: { id: true }
					})
				).map((f) => f.id)
			);
			const rows = assets
				.filter((a) => known.has(a.fileId))
				.map((a) => ({
					template_id: row.id,
					key: a.key,
					file_id: a.fileId,
					date_created: now
				}));
			if (rows.length > 0) {
				await dbDirect.insert(presentation_template_assets).values(rows).onConflictDoNothing();
			}
		}

		imported++;
	}

	return { imported, assetsRestored };
}

/** Every presentation template the profile owns, of both kinds. */
export async function deleteProfilePresentationTemplates(profileId: number): Promise<void> {
	await dbDirect
		.delete(presentation_templates)
		.where(eq(presentation_templates.profile_id, profileId));
}
