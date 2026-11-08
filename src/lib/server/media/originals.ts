/**
 * Turning an upload into a media library original.
 *
 * What is stored is the upload itself, less its metadata, and nothing else
 * happens to it: no resize, no conversion, no re-encode (see
 * strip-metadata.ts for how). What is read out of it first is what the
 * renditions need and the metadata would otherwise take with it: the size,
 * whether it has transparency, and the orientation a camera wrote.
 *
 * Two kinds of input cannot be cleaned that way:
 *
 * - AVIF and TIFF. Cutting metadata out of them by hand means rewriting box
 *   offsets (AVIF) or IFD chains (TIFF), and they are rare as uploads. They are
 *   stored as a lossless PNG of the same pixels instead, turned upright with
 *   their colour profile kept. Bigger, but not a generation lost.
 * - HEIC, an iPhone's default. The sharp build the app ships decodes AV1 in
 *   a HEIF container (AVIF) and not HEVC, so a HEIC photo cannot be read at all.
 *   It is refused with what to do instead, rather than as "not an image".
 */

import sharp, { type Metadata } from 'sharp';
import { MetadataStripError, stripMetadataLossless, type StrippableFormat } from './strip-metadata';

/** The same raw cap the private image path uses (`documents/media.ts`). */
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

/**
 * Refuse to decode beyond this, whatever the header claims. The byte cap is the
 * first line against a decompression bomb; this is the second, because a small
 * file is free to claim enormous dimensions.
 */
export const MAX_ORIGINAL_PIXELS = 50_000_000;

export class MediaUploadError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MediaUploadError';
	}
}

export type StoredFormat = StrippableFormat;

export type SniffedFormat = StrippableFormat | 'avif' | 'tiff' | 'heic' | 'unknown';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** HEIF brands that mean HEVC coding, which this build of sharp cannot decode. */
const HEVC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs']);

/** What the bytes are, told by their signature rather than the file's name. */
export function sniffFormat(bytes: Buffer): SniffedFormat {
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
		return 'jpeg';
	if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png';
	if (bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') {
		return 'webp';
	}
	if (bytes.toString('latin1', 0, 4) === 'GIF8') return 'gif';
	const tiff = bytes.toString('latin1', 0, 4);
	if (tiff === 'II*\0' || tiff === 'MM\0*') return 'tiff';
	if (bytes.toString('latin1', 4, 8) === 'ftyp' && bytes.length >= 16) {
		const boxSize = Math.min(bytes.readUInt32BE(0), bytes.length);
		const brands = [bytes.toString('latin1', 8, 12)];
		for (let at = 16; at + 4 <= boxSize; at += 4) brands.push(bytes.toString('latin1', at, at + 4));
		if (brands.includes('avif') || brands.includes('avis')) return 'avif';
		if (brands.some((b) => HEVC_BRANDS.has(b)) || brands.includes('mif1')) return 'heic';
		return 'unknown';
	}
	// SVG is text: look for the root element near the start, past any XML
	// declaration, doctype or comment.
	const head = bytes.toString('utf8', 0, Math.min(bytes.length, 4096)).replace(/^\uFEFF/, '');
	if (
		/^\s*(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*|<!DOCTYPE[\s\S]*?>\s*)*<svg[\s>]/i.test(head)
	) {
		return 'svg';
	}
	return 'unknown';
}

export const FORMAT_EXTENSIONS: Record<StoredFormat, string> = {
	jpeg: '.jpg',
	png: '.png',
	webp: '.webp',
	gif: '.gif',
	svg: '.svg'
};

export const FORMAT_MIME_TYPES: Record<StoredFormat, string> = {
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	gif: 'image/gif',
	svg: 'image/svg+xml'
};

export interface PreparedOriginal {
	/** The bytes to store. */
	bytes: Buffer;
	format: StoredFormat;
	/** Pixel size as the picture is seen, with `orientation` applied. */
	width: number;
	height: number;
	hasAlpha: boolean;
	/** The EXIF orientation the upload carried, 1-8. */
	orientation: number;
}

function validOrientation(value: number | undefined): number {
	return value && Number.isInteger(value) && value >= 1 && value <= 8 ? value : 1;
}

const HEIC_REFUSAL =
	"HEIC photos (an iPhone's default) can't be read here. Share or export it as a JPEG, " +
	'or set Settings > Camera > Formats to Most Compatible, and upload that.';

/**
 * Read an upload and return what to store for it.
 *
 * Throws `MediaUploadError` with a sentence for the uploader. A file the
 * metadata cannot be proven gone from is refused rather than stored: the
 * original is private, but it travels in exports, and "we tried" is not a
 * property anyone can rely on.
 */
export async function prepareOriginal(input: Buffer): Promise<PreparedOriginal> {
	if (input.length > MAX_ORIGINAL_BYTES) {
		throw new MediaUploadError(
			`That file is ${Math.round(input.length / (1024 * 1024))} MB; the limit is ${MAX_ORIGINAL_BYTES / (1024 * 1024)} MB.`
		);
	}
	const sniffed = sniffFormat(input);
	if (sniffed === 'heic') throw new MediaUploadError(HEIC_REFUSAL);
	if (sniffed === 'unknown') {
		throw new MediaUploadError(
			'Not an image the library can read: JPEG, PNG, WebP, GIF, SVG, AVIF or TIFF.'
		);
	}

	let meta: Metadata;
	try {
		meta = await sharp(input, { limitInputPixels: MAX_ORIGINAL_PIXELS }).metadata();
	} catch {
		throw new MediaUploadError('That file could not be read as an image.');
	}
	if (!meta.width || !meta.height) throw new MediaUploadError('That image has no size.');
	if (meta.width * meta.height > MAX_ORIGINAL_PIXELS) {
		throw new MediaUploadError(
			`That image is ${meta.width}x${meta.height}; the limit is ${MAX_ORIGINAL_PIXELS / 1_000_000} megapixels.`
		);
	}

	if (sniffed === 'avif' || sniffed === 'tiff') {
		let png: Buffer;
		try {
			png = await sharp(input, { limitInputPixels: MAX_ORIGINAL_PIXELS })
				.rotate()
				.keepIccProfile()
				.png({ compressionLevel: 9 })
				.toBuffer();
		} catch {
			throw new MediaUploadError('That file could not be read as an image.');
		}
		const after = await sharp(png).metadata();
		return {
			bytes: png,
			format: 'png',
			width: after.width ?? meta.width,
			height: after.height ?? meta.height,
			hasAlpha: !!after.hasAlpha,
			orientation: 1
		};
	}

	const orientation =
		sniffed === 'svg' || sniffed === 'gif' ? 1 : validOrientation(meta.orientation);
	let bytes: Buffer;
	try {
		bytes = stripMetadataLossless(input, sniffed);
	} catch (err) {
		if (err instanceof MetadataStripError) throw new MediaUploadError(err.message);
		throw err;
	}

	// The proof, read back by the decoder that will draw every rendition: the
	// same picture, and nothing left that names where or by what it was taken.
	let after: Metadata;
	try {
		after = await sharp(bytes, { limitInputPixels: MAX_ORIGINAL_PIXELS }).metadata();
	} catch {
		throw new MediaUploadError('That image could not be cleaned without damaging it.');
	}
	if (after.width !== meta.width || after.height !== meta.height) {
		throw new MediaUploadError('That image could not be cleaned without damaging it.');
	}
	if (after.exif || after.xmp || after.iptc || (after.comments?.length ?? 0) > 0) {
		throw new MediaUploadError(
			"Could not remove all of that image's metadata, so it was not stored."
		);
	}

	const sideways = orientation >= 5;
	return {
		bytes,
		format: sniffed,
		width: sideways ? meta.height : meta.width,
		height: sideways ? meta.width : meta.height,
		hasAlpha: !!meta.hasAlpha,
		orientation
	};
}
