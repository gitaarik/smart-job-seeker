/**
 * Restore custom CV templates.
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
 * `resume_template_assets`, where they live now. This happens on import rather
 * than in the archive format because an archive written before that table
 * existed has to import into it too: the file still carries the ids in the
 * config, and this is the one place that turns them into rows. Whatever is not
 * recognised as an asset stays in the config untouched.
 */

import { dbDirect } from '$lib/server/db';
import { eq, inArray } from 'drizzle-orm';
import { files, resume_template_assets, resume_templates } from '$lib/server/db/schema';
import { uploadFile } from '$lib/server/files';
import type { ExportedResumeTemplate } from './types';
import type { ResumeTemplateConfig } from '$lib/resume-templates';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
		const slug =
			template.slug?.trim() ||
			name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/(^-|-$)/g, '') ||
			'imported-template';

		const { config, assets } = splitConfigAssets(rewriteConfigFileIds(template.config, idMap));

		const [row] = await dbDirect
			.insert(resume_templates)
			.values({
				profile_id: profileId,
				name,
				slug,
				status: template.status || 'draft',
				sort: template.sort ?? null,
				config,
				date_created: now,
				date_updated: now
			})
			.returning({ id: resume_templates.id });

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
				await dbDirect.insert(resume_template_assets).values(rows).onConflictDoNothing();
			}
		}

		imported++;
	}

	return { imported, assetsRestored };
}

export async function deleteProfileResumeTemplates(profileId: number): Promise<void> {
	await dbDirect.delete(resume_templates).where(eq(resume_templates.profile_id, profileId));
}
