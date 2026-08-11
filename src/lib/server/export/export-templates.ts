/**
 * Export custom CV templates (`resume_templates`).
 *
 * A template is config plus a handful of images the config points at by file
 * id — `config.assets.*` and `config.thumbnail` today, but the shape is the
 * template author's to change. Rather than hard-code those keys, this walks the
 * config for anything that looks like a file id and checks it against the file
 * store, so an asset added under a new key still travels.
 *
 * The config itself is exported verbatim, ids and all; the importer rewrites
 * them once the assets have new ids. That keeps a template with no assets a
 * byte-exact round trip.
 */

import { dbDirect } from '$lib/server/db';
import { asc, eq, inArray } from 'drizzle-orm';
import { files, resume_templates } from '$lib/server/db/schema';
import { getFile } from '$lib/server/files';
import type { ExportedResumeTemplate, ExportedTemplateAsset, TemplateAssetPayload } from './types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every UUID-shaped string value anywhere in the config. */
export function collectFileIdCandidates(config: unknown): string[] {
	const found = new Set<string>();

	const walk = (node: unknown) => {
		if (typeof node === 'string') {
			if (UUID_RE.test(node)) found.add(node);
			return;
		}
		if (Array.isArray(node)) {
			node.forEach(walk);
			return;
		}
		if (node && typeof node === 'object') {
			Object.values(node as Record<string, unknown>).forEach(walk);
		}
	};

	walk(config);
	return [...found];
}

export async function buildTemplateExport(
	profileId: number,
	includeAssets: boolean
): Promise<{ templates: ExportedResumeTemplate[]; assetPayloads: TemplateAssetPayload[] }> {
	const rows = await dbDirect.query.resume_templates.findMany({
		where: eq(resume_templates.profile_id, profileId),
		orderBy: [asc(resume_templates.sort), asc(resume_templates.id)]
	});

	const templates: ExportedResumeTemplate[] = [];
	const assetPayloads: TemplateAssetPayload[] = [];

	for (const [index, row] of rows.entries()) {
		const assets: ExportedTemplateAsset[] = [];

		if (includeAssets) {
			const candidates = collectFileIdCandidates(row.config);

			// One query decides which candidates are real files; a UUID in the
			// config that isn't in the file store is left alone.
			const known = candidates.length
				? await dbDirect.query.files.findMany({
						where: inArray(files.id, candidates),
						columns: { id: true, filename_download: true }
					})
				: [];

			for (const file of known) {
				try {
					const buffer = await getFile(file.id);
					const filename = file.filename_download || `${file.id}`;
					const archivePath = `templates/${String(index + 1).padStart(2, '0')}-${row.slug || 'template'}/${filename}`;

					assets.push({ file_id: file.id, archivePath, filename });
					assetPayloads.push({ archivePath, buffer });
				} catch (error) {
					console.warn(`[Export] Could not read template asset ${file.id}:`, error);
				}
			}
		}

		templates.push({
			name: row.name || undefined,
			slug: row.slug || undefined,
			status: row.status || undefined,
			sort: row.sort,
			config: row.config,
			assets
		});
	}

	return { templates, assetPayloads };
}
