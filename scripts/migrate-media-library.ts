/**
 * Move every image the app already shows into the media library.
 *
 * Before the library, each slot kept its own copy: profile photos and the
 * logos and banners of roles, education and side projects as files under
 * `uploads/` named by a `*_path` column, a portfolio theme's images as `files`
 * rows on `presentation_template_assets`. This turns each into a library item
 * with a full-frame rendition and points the slot at the rendition, so the
 * slot works the way new uploads do (see planning/MEDIA-LIBRARY.md, "The day
 * it lands").
 *
 * **Nothing displays differently.** The rendition's bytes are a copy of the
 * file the slot served before, not a re-encode of it, so every page shows the
 * same pixels at a new URL. The item's original is that same copy too: for the
 * entity slots it is the 800px one, because the real originals were shrunk
 * away at upload. Upload a real original as a new version of the item to fix
 * that.
 *
 * CV template artwork stays as it is: it travels with its template, and
 * `seeds/` owns Citrus's (the plan's open question 2).
 *
 * Until this has run, readers fall back to the old paths, so a database it has
 * not reached yet keeps working. Safe to re-run: it only touches slots that
 * still hold an old path and no rendition, and theme slots that still hold a
 * plain file. A file that is missing on disk is reported and left alone.
 *
 * Dry run by default.
 *
 *   # from cloud/
 *   docker compose exec -T app npx tsx scripts/migrate-media-library.ts [--apply]
 *   # on a deployed box
 *   docker exec sjs-preview-app-1 npx dotenvx run -- node dist-scripts/migrate-media-library.mjs [--apply]
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import {
	files,
	media_items,
	media_renditions,
	presentation_template_assets,
	presentation_templates
} from '$lib/server/db/schema';
import { getFile, uploadFile } from '$lib/server/files';
import { deleteUpload } from '$lib/server/uploads';
import { reapFileRefs } from '$lib/server/uploads/reap';
import { stripImageMetadata } from '$lib/server/uploads/public-image';
import { prepareOriginal, FORMAT_EXTENSIONS, FORMAT_MIME_TYPES } from '$lib/server/media/originals';
import { OUTPUT_MIME_TYPES } from '$lib/server/media/renditions';
import { renderImage } from '$lib/server/media/render';
import {
	ENTITY_MEDIA_SLOTS,
	isOutputFormat,
	THEME_MEDIA_SLOTS,
	type MediaKind,
	type OutputFormat
} from '$lib/media-library';

const APPLY = process.argv.includes('--apply');
const UPLOADS_DIR = join(process.cwd(), 'uploads');

interface EntitySlotJob {
	table: string;
	column: string;
	legacy: string;
	/** The column that names the row, for the item's label. */
	nameColumn: string | null;
	slot: string;
	kind: MediaKind;
	profileColumn: string;
}

const ENTITY_JOBS: EntitySlotJob[] = [
	{
		table: 'profiles',
		column: 'profile_photo_id',
		legacy: 'profile_photo_path',
		nameColumn: 'name',
		slot: 'Profile photo',
		kind: ENTITY_MEDIA_SLOTS.profile.photo.kind,
		profileColumn: 'id'
	},
	...(['logo', 'banner'] as const).flatMap((slot) => [
		{
			table: 'work_experiences',
			column: `${slot}_id`,
			legacy: `${slot}_path`,
			nameColumn: 'name',
			slot,
			kind: ENTITY_MEDIA_SLOTS.work_experience[slot].kind,
			profileColumn: 'profile_id'
		},
		{
			table: 'education',
			column: `${slot}_id`,
			legacy: `${slot}_path`,
			nameColumn: 'institution',
			slot,
			kind: ENTITY_MEDIA_SLOTS.education[slot].kind,
			profileColumn: 'profile_id'
		}
	]),
	...(['image', 'banner'] as const).map((slot) => ({
		table: 'side_projects',
		column: `${slot}_id`,
		legacy: `${slot}_path`,
		nameColumn: 'name',
		slot,
		kind: ENTITY_MEDIA_SLOTS.side_project[slot].kind,
		profileColumn: 'profile_id'
	}))
];

interface Converted {
	itemId: number;
	renditionId: string;
}

/**
 * One image into the library: an item whose original is a copy of `bytes`, and
 * a full-frame rendition whose cached file is the same picture as served
 * today. Throws when the bytes are not an image the library can take.
 */
async function convert(
	bytes: Buffer,
	profileId: number,
	kind: MediaKind,
	label: string,
	filename: string
): Promise<Converted> {
	const prepared = await prepareOriginal(bytes);
	const stem = filename.replace(/\.[^.]+$/, '') || 'image';
	const original = await uploadFile({
		filename: `${stem}${FORMAT_EXTENSIONS[prepared.format]}`,
		buffer: prepared.bytes,
		title: label,
		mimeType: FORMAT_MIME_TYPES[prepared.format]
	});
	const [item] = await db
		.insert(media_items)
		.values({
			profile_id: profileId,
			kind,
			label,
			file_id: original.id,
			width: prepared.width,
			height: prepared.height,
			format: prepared.format,
			has_alpha: prepared.hasAlpha,
			orientation: prepared.orientation,
			date_created: new Date()
		})
		.returning();

	// What the slot served, byte for byte where the format allows: the public
	// copy keeps no metadata (public-image.ts), which is a no-op on any file
	// written since 2026-11-08.
	let format: OutputFormat;
	let served: Buffer;
	if (isOutputFormat(prepared.format) && prepared.orientation === 1) {
		format = prepared.format;
		served = await stripImageMetadata(bytes);
	} else {
		// A GIF, an SVG or a sideways photo: drawn once, as every new
		// rendition is. Rare among files the old pipeline wrote.
		format = prepared.hasAlpha || prepared.format === 'svg' ? 'png' : 'jpeg';
		served = (
			await renderImage(
				{
					original: prepared.bytes,
					format: prepared.format,
					orientation: prepared.orientation,
					width: prepared.width,
					height: prepared.height
				},
				{
					crop: { x: 0, y: 0, w: prepared.width, h: prepared.height },
					width: prepared.width,
					height: prepared.height,
					format
				}
			)
		).bytes;
	}
	const cached = await uploadFile({
		filename: `${stem}-${prepared.width}x${prepared.height}${format === 'jpeg' ? '.jpg' : `.${format}`}`,
		buffer: served,
		title: `Rendition of media item ${item.id}`,
		mimeType: OUTPUT_MIME_TYPES[format]
	});
	const [rendition] = await db
		.insert(media_renditions)
		.values({
			item_id: item.id,
			preset_id: null,
			crop_x: 0,
			crop_y: 0,
			crop_w: prepared.width,
			crop_h: prepared.height,
			width: prepared.width,
			height: prepared.height,
			format,
			file_id: cached.id,
			date_created: new Date()
		})
		.returning({ id: media_renditions.id });
	return { itemId: item.id, renditionId: rendition.id };
}

async function migrateEntitySlots() {
	let converted = 0;
	let missing = 0;
	let failed = 0;
	const unlink: string[] = [];
	const byPath = new Map<string, Converted>();

	for (const job of ENTITY_JOBS) {
		const name = job.nameColumn ? sql.identifier(job.nameColumn) : sql`NULL`;
		const rows = await queryRawDirect<{
			id: number;
			profile_id: number;
			path: string;
			name: string | null;
		}>(sql`
			SELECT id, ${sql.identifier(job.profileColumn)} AS profile_id,
			       ${sql.identifier(job.legacy)} AS path, ${name}::text AS name
			  FROM ${sql.identifier(job.table)}
			 WHERE ${sql.identifier(job.legacy)} IS NOT NULL
			   AND ${sql.identifier(job.column)} IS NULL
			 ORDER BY id
		`);
		for (const row of rows) {
			const where = `${job.table}.${job.legacy} #${row.id} (${row.path})`;
			let bytes: Buffer;
			try {
				bytes = await readFile(join(UPLOADS_DIR, row.path));
			} catch {
				console.log(`  missing on disk, left alone: ${where}`);
				missing++;
				continue;
			}
			if (!APPLY) {
				console.log(`  would convert ${where}`);
				converted++;
				continue;
			}
			try {
				let done = byPath.get(row.path) ?? null;
				if (!done) {
					const label =
						job.table === 'profiles'
							? 'Profile photo'
							: `${row.name?.trim() || job.table.replace(/_/g, ' ')} ${job.slot}`;
					done = await convert(
						bytes,
						row.profile_id,
						job.kind,
						label,
						row.path.split('/').pop() ?? 'image'
					);
					byPath.set(row.path, done);
				}
				await queryRawDirect(sql`
					UPDATE ${sql.identifier(job.table)}
					   SET ${sql.identifier(job.column)} = ${done.renditionId}::uuid,
					       ${sql.identifier(job.legacy)} = NULL
					 WHERE id = ${row.id}
				`);
				unlink.push(row.path);
				converted++;
				console.log(`  converted ${where} -> item ${done.itemId}`);
			} catch (err) {
				failed++;
				console.error(`  FAILED ${where}:`, err instanceof Error ? err.message : err);
			}
		}
	}

	// Only once every row naming a file points at its copy.
	for (const path of new Set(unlink)) await deleteUpload(path).catch(() => {});
	return { converted, missing, failed };
}

async function migrateThemeAssets() {
	let converted = 0;
	let missing = 0;
	let failed = 0;
	const replaced: string[] = [];
	const byFile = new Map<string, Converted>();

	const rows = await db
		.select({
			assetId: presentation_template_assets.id,
			key: presentation_template_assets.key,
			fileId: presentation_template_assets.file_id,
			profileId: presentation_templates.profile_id,
			themeName: presentation_templates.name,
			filename: files.filename_download
		})
		.from(presentation_template_assets)
		.innerJoin(
			presentation_templates,
			eq(presentation_templates.id, presentation_template_assets.template_id)
		)
		.innerJoin(files, eq(files.id, presentation_template_assets.file_id))
		.where(
			and(
				eq(presentation_templates.kind, 'portfolio'),
				isNotNull(presentation_template_assets.file_id)
			)
		)
		.orderBy(presentation_template_assets.id);

	for (const row of rows) {
		const fileId = row.fileId;
		if (!fileId) continue;
		const where = `theme "${row.themeName}" ${row.key} (file ${fileId})`;
		const spec = (THEME_MEDIA_SLOTS as Record<string, { kind: MediaKind }>)[row.key];
		let bytes: Buffer;
		try {
			bytes = await getFile(fileId);
		} catch {
			console.log(`  missing on disk, left alone: ${where}`);
			missing++;
			continue;
		}
		try {
			await sharp(bytes).metadata();
		} catch {
			console.log(`  not an image, left alone: ${where}`);
			continue;
		}
		if (!APPLY) {
			console.log(`  would convert ${where}`);
			converted++;
			continue;
		}
		try {
			let done = byFile.get(fileId) ?? null;
			if (!done) {
				done = await convert(
					bytes,
					row.profileId,
					spec?.kind ?? 'other',
					`${row.themeName} ${row.key}`,
					row.filename || 'image'
				);
				byFile.set(fileId, done);
			}
			await db
				.update(presentation_template_assets)
				.set({ file_id: null, rendition_id: done.renditionId })
				.where(eq(presentation_template_assets.id, row.assetId));
			replaced.push(fileId);
			converted++;
			console.log(`  converted ${where} -> item ${done.itemId}`);
		} catch (err) {
			failed++;
			console.error(`  FAILED ${where}:`, err instanceof Error ? err.message : err);
		}
	}

	// The old blobs, where nothing else still points at them (a CV template can
	// share one). The reap asks the catalog, so it cannot delete a shared file.
	if (replaced.length) {
		const reaped = await reapFileRefs({ fileIds: [...new Set(replaced)], mediaPaths: [] });
		console.log(
			`  old theme files deleted: ${reaped.filesDeleted}, kept (still used): ${reaped.filesRetained}`
		);
	}
	return { converted, missing, failed };
}

async function main() {
	console.log(`${APPLY ? 'Applying' : 'Dry run'}: media library conversion\n`);
	console.log('Profile photos and entity logos, banners and images:');
	const entities = await migrateEntitySlots();
	console.log('\nPortfolio theme images:');
	const themes = await migrateThemeAssets();
	console.log(
		`\n${APPLY ? 'Converted' : 'Would convert'}: ${entities.converted} slot images, ${themes.converted} theme images. ` +
			`Missing on disk: ${entities.missing + themes.missing}. Failed: ${entities.failed + themes.failed}.`
	);
	if (!APPLY) console.log('Run again with --apply to write.');
	if (entities.failed + themes.failed > 0) process.exitCode = 1;
}

main()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.then(() => process.exit());
