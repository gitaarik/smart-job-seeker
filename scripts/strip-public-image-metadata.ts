/**
 * Take the metadata out of every image the app already serves publicly.
 *
 * Until 2026-11-08 profile photos and the logos and banners of roles,
 * education and side projects kept their EXIF (`entity-media.ts` called
 * `withMetadata()`), and portfolio theme images, imported media and imported
 * template artwork were stored exactly as they arrived. The paths that write
 * them are fixed (`src/lib/server/uploads/public-image.ts`); this cleans what
 * they wrote before.
 *
 * It reads the same two places the public routes serve:
 * - `uploads/` minus the private `files/` store (`/uploads/[...path]`);
 * - the blobs `presentation_template_assets` points at (`/assets/[id]`), whose
 *   `files.filesize` is updated to match.
 *
 * A file is rewritten in place, under its own name, so nothing that references
 * it has to change. The cost is that a browser which cached the old bytes keeps
 * them, since both routes send `immutable`. When this was written no public
 * image on dev or preview carried a location, which makes that a fair trade;
 * if a run ever reports GPS, give those files new names as well.
 *
 * Dry run by default: it says what it would rewrite, and names every file
 * whose EXIF holds a location or a camera. Safe to re-run, because a clean
 * file is left alone.
 *
 *   # from cloud/oss
 *   docker compose exec -T app npx tsx scripts/strip-public-image-metadata.ts [--apply]
 *   # on a deployed box
 *   docker exec sjs-preview-app-1 node dist-scripts/strip-public-image-metadata.mjs [--apply]
 */

import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { files, presentation_template_assets } from '$lib/server/db/schema';
import { stripImageMetadata } from '$lib/server/uploads/public-image';

const APPLY = process.argv.includes('--apply');
const UPLOADS_DIR = join(process.cwd(), 'uploads');
const PRIVATE_SUBDIR = 'files';

interface Target {
	path: string;
	/** Set for a blob, whose `files` row records its size. */
	fileId?: string;
}

/** Every file under `uploads/`, skipping the private store. */
async function publicUploads(dir: string): Promise<Target[]> {
	const out: Target[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (relative(UPLOADS_DIR, path) === PRIVATE_SUBDIR) continue;
		if (entry.isDirectory()) out.push(...(await publicUploads(path)));
		else if (entry.isFile()) out.push({ path });
	}
	return out;
}

/** The blobs a template or portfolio theme points at, each once. */
async function publicBlobs(): Promise<Target[]> {
	const rows = await db
		.selectDistinct({ id: files.id, disk: files.filename_disk })
		.from(presentation_template_assets)
		.innerJoin(files, eq(files.id, presentation_template_assets.file_id));
	return rows.flatMap((r) =>
		r.disk ? [{ path: join(UPLOADS_DIR, PRIVATE_SUBDIR, r.disk), fileId: r.id }] : []
	);
}

/**
 * What an EXIF block says that matters here: whether it holds a GPS block, and
 * which camera it names. Reads IFD0 only, which is where both are declared.
 */
function readExif(exif: Buffer): { gps: boolean; camera: string } {
	try {
		const tiff = exif.subarray(0, 6).toString('latin1') === 'Exif\0\0' ? exif.subarray(6) : exif;
		const le = tiff.toString('latin1', 0, 2) === 'II';
		const u16 = (at: number) => (le ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at));
		const u32 = (at: number) => (le ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at));
		const ifd0 = u32(4);
		const tags = new Map<number, { count: number; at: number }>();
		for (let i = 0; i < u16(ifd0); i++) {
			const at = ifd0 + 2 + i * 12;
			tags.set(u16(at), { count: u32(at + 4), at });
		}
		const text = (tag: number) => {
			const t = tags.get(tag);
			if (!t) return '';
			const start = t.count <= 4 ? t.at + 8 : u32(t.at + 8);
			return tiff.toString('latin1', start, start + t.count).replace(/\0+$/, '');
		};
		const camera = [text(0x010f), text(0x0110)].filter(Boolean).join(' ');
		return { gps: tags.has(0x8825), camera };
	} catch {
		// A block too damaged to read is still a block, and still goes.
		return { gps: false, camera: '' };
	}
}

/** A file's bytes and what sharp reads from its header, or null if it is not an image. */
async function readImage(path: string) {
	try {
		const bytes = await readFile(path);
		return { bytes, meta: await sharp(bytes).metadata() };
	} catch {
		return null;
	}
}

async function main() {
	const targets = [...(await publicUploads(UPLOADS_DIR)), ...(await publicBlobs())];
	console.log(`${APPLY ? 'Applying' : 'Dry run'}: ${targets.length} public files\n`);

	let images = 0;
	let carrying = 0;
	let withGps = 0;
	let withCamera = 0;
	let rewritten = 0;
	let failed = 0;

	for (const target of targets) {
		const name = relative(UPLOADS_DIR, target.path);
		const image = await readImage(target.path);
		if (!image) continue; // missing, or not an image: nothing for this to do
		const { bytes, meta } = image;
		images++;
		if (!meta.exif && !meta.xmp && !meta.iptc && !meta.comments?.length) continue;
		carrying++;

		const { gps, camera } = meta.exif ? readExif(meta.exif) : { gps: false, camera: '' };
		if (gps) withGps++;
		if (camera) withCamera++;
		if (gps || camera) {
			console.log(`  ${name}${gps ? '  GPS' : ''}${camera ? `  camera: ${camera}` : ''}`);
		}
		if (!APPLY) continue;

		try {
			const clean = await stripImageMetadata(bytes);
			if (clean === bytes) {
				// It carries metadata, so the same bytes back means a format the
				// upload routes never accepted and this does not rewrite.
				console.log(`  ${name}: left as it is (${meta.format} is not rewritten)`);
				continue;
			}
			// Written beside the original and renamed over it, so a reader never
			// gets half a file.
			const temp = `${target.path}.strip-tmp`;
			await writeFile(temp, clean);
			await rename(temp, target.path);
			if (target.fileId) {
				await db.update(files).set({ filesize: clean.length }).where(eq(files.id, target.fileId));
			}
			rewritten++;
		} catch (err) {
			failed++;
			console.error(`  could not rewrite ${name}: ${err instanceof Error ? err.message : err}`);
		}
	}

	console.log(
		`\n${images} images, ${carrying} carrying metadata` +
			` (${withGps} with GPS, ${withCamera} naming a camera)`
	);
	if (APPLY) console.log(`Rewrote ${rewritten}${failed ? `, ${failed} failed` : ''}.`);
	else if (carrying) console.log('Re-run with --apply to rewrite them.');
	if (failed) process.exitCode = 1;
}

main()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.then(() => process.exit());
