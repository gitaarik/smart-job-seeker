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
 */

import { dbDirect } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { resume_templates } from '$lib/server/db/schema';
import { uploadFile } from '$lib/server/files';
import type { ExportedResumeTemplate } from './types';

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

		await dbDirect.insert(resume_templates).values({
			profile_id: profileId,
			name,
			slug,
			status: template.status || 'draft',
			sort: template.sort ?? null,
			config: rewriteConfigFileIds(template.config, idMap),
			date_created: now,
			date_updated: now
		});

		imported++;
	}

	return { imported, assetsRestored };
}

export async function deleteProfileResumeTemplates(profileId: number): Promise<void> {
	await dbDirect.delete(resume_templates).where(eq(resume_templates.profile_id, profileId));
}
