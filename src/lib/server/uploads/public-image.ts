/**
 * What an image loses on its way to being public: its metadata.
 *
 * Two routes serve images to anyone who asks. `/uploads/[...path]` serves
 * everything under `uploads/` except the private `files/` store, which is where
 * profile photos and the logos and banners of roles, education and side
 * projects live. `/assets/[id]` serves any blob a template or portfolio theme
 * points at. Both answer `immutable` for a year. A phone writes the place a
 * photo was taken into its EXIF, so an image that reaches either route with its
 * metadata intact publishes that place, to every cache that fetches it.
 *
 * sharp drops metadata unless it is asked to keep it, and that is the whole
 * mechanism here: nothing in this file calls `withMetadata()`, `keepExif()` or
 * `keepMetadata()`. `entity-media.ts` used to call `withMetadata()`, under a
 * comment saying "Strip EXIF data", which is the opposite of what it does; the
 * portfolio theme upload and both imports stored what they were given. So until
 * 2026-11-08 every one of those kept its EXIF. When that was found, no public
 * image on dev (72) or preview (40) carried a location, and one named the phone
 * and the minute it was taken. That was luck, not design.
 *
 * `documents/media.ts` is the private counterpart, and drops metadata for the
 * same reason.
 */

import sharp from 'sharp';

export interface EntityImageOptions {
	maxWidth?: number;
	maxHeight?: number;
	quality?: number;
}

/**
 * A photo, logo or banner shaped for `uploads/`: turned upright, fitted inside
 * 800x800 unless told otherwise, and a JPEG unless it is a PNG with
 * transparency.
 *
 * This is what `saveEntityMedia` always did, less the metadata, including the
 * parts worth knowing about: `png({ quality })` also quantizes to a palette, and
 * a WebP or GIF with transparency comes out as an opaque JPEG.
 */
export async function processEntityImage(
	buffer: Buffer,
	mimeType: string,
	options: EntityImageOptions = {}
): Promise<{ bytes: Buffer; ext: '.jpg' | '.png' }> {
	const { maxWidth = 800, maxHeight = 800, quality = 85 } = options;
	const metadata = await sharp(buffer).metadata();

	// `rotate()` with no angle applies the EXIF orientation to the pixels: the
	// one thing worth reading out of the EXIF before it goes.
	let pipeline = sharp(buffer).rotate();

	if ((metadata.width ?? 0) > maxWidth || (metadata.height ?? 0) > maxHeight) {
		pipeline = pipeline.resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true });
	}

	if (mimeType === 'image/png' && metadata.hasAlpha) {
		return { bytes: await pipeline.png({ quality }).toBuffer(), ext: '.png' };
	}
	return { bytes: await pipeline.jpeg({ quality }).toBuffer(), ext: '.jpg' };
}

type RasterFormat = 'jpeg' | 'png' | 'webp' | 'gif';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** The four formats the upload routes take, told apart by signature, not by name. */
function rasterFormat(bytes: Buffer): RasterFormat | null {
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return 'jpeg';
	}
	if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png';
	if (bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') {
		return 'webp';
	}
	if (bytes.toString('latin1', 0, 4) === 'GIF8') return 'gif';
	return null;
}

/**
 * Whether a WebP was encoded losslessly, read from its chunks. A logo saved
 * that way would grow artefacts along every hard edge from a lossy re-encode.
 * The image chunk is `VP8L` when lossless and `VP8 ` (after an `ALPH`, with
 * transparency) when not, either at the top level or as the first chunk inside
 * an animation's first frame, after that frame's 16-byte header.
 */
function isLosslessWebp(bytes: Buffer): boolean {
	let at = 12;
	while (at + 8 <= bytes.length) {
		const fourcc = bytes.toString('latin1', at, at + 4);
		if (fourcc === 'VP8L') return true;
		if (fourcc === 'VP8 ' || fourcc === 'ALPH') return false;
		if (fourcc === 'ANMF') return bytes.toString('latin1', at + 24, at + 28) === 'VP8L';
		const size = bytes.readUInt32LE(at + 4);
		at += 8 + size + (size & 1);
	}
	return false;
}

const JPEG_QUALITY = 92;
const WEBP_QUALITY = 92;

/** Whether `out` holds the pixels of `input` turned upright, read as stored. */
async function samePixels(out: Buffer, input: Buffer): Promise<boolean> {
	const [a, b] = await Promise.all([
		sharp(out, { ignoreIcc: true }).raw().toBuffer(),
		sharp(input, { ignoreIcc: true }).rotate().raw().toBuffer()
	]);
	return a.equals(b);
}

/**
 * The same image without its metadata, for the paths that publish what they
 * were given rather than a resized copy: a portfolio theme's images, and the
 * photos, logos and template artwork an import brings in.
 *
 * - Nothing to remove, nothing done: the input comes back as it was, so a clean
 *   file is never re-encoded for nothing.
 * - Not one of the four raster formats the upload routes take: also returned as
 *   it was. A template can carry other files, and a camera writes into none of
 *   them.
 * - A raster image sharp cannot decode throws. Storing it raw could store its
 *   EXIF too, so each caller refuses it or skips it instead.
 *
 * Same format out as in. PNG and lossless WebP stay lossless; a JPEG or a lossy
 * WebP is re-encoded once at a high quality, the price of doing this with the
 * encoder the app already trusts rather than cutting segments out by hand. The
 * colour profile stays: it says how to show the pixels, not who took them, and
 * keeping it is what keeps a Display P3 screenshot's pixel values exact.
 */
export async function stripImageMetadata(bytes: Buffer): Promise<Buffer> {
	const format = rasterFormat(bytes);
	if (!format) return bytes;

	const meta = await sharp(bytes, { animated: true }).metadata();
	if (!meta.exif && !meta.xmp && !meta.iptc && !meta.comments?.length) return bytes;

	// An animated GIF or WebP keeps its frames. Auto-rotate is not available on
	// one, and is not needed: only cameras write the orientation tag.
	const animated = (meta.pages ?? 1) > 1;
	let pipeline = sharp(bytes, { animated }).keepIccProfile();
	if (!animated) pipeline = pipeline.rotate();

	switch (format) {
		case 'jpeg':
			return pipeline
				.jpeg({
					quality: JPEG_QUALITY,
					mozjpeg: true,
					chromaSubsampling: meta.chromaSubsampling === '4:4:4' ? '4:4:4' : '4:2:0'
				})
				.toBuffer();
		case 'png': {
			// A palette PNG (which is what `processEntityImage` writes) stays one:
			// as full colour it came back 29% bigger. The palette is rebuilt rather
			// than copied, so it is only used when the pixels prove identical.
			if (meta.isPalette) {
				const indexed = await pipeline.clone().png({ palette: true }).toBuffer();
				if (await samePixels(indexed, bytes)) return indexed;
			}
			return pipeline.png().toBuffer();
		}
		case 'webp':
			return pipeline
				.webp(isLosslessWebp(bytes) ? { lossless: true } : { quality: WEBP_QUALITY })
				.toBuffer();
		case 'gif':
			return pipeline.gif().toBuffer();
	}
}
