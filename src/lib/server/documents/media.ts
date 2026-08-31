/**
 * Images kept as images.
 *
 * Every other path in this directory turns an upload into text and throws the
 * bytes away, which is right for a PDF or a repository and useless for a
 * screenshot: the value of an architecture diagram is the diagram. So media
 * takes the other branch — the file is stored, the row points at it, and
 * nothing is extracted.
 *
 * What arrives is not what is stored. Every image is re-encoded to WebP at a
 * bounded size, and that one step is doing three jobs at once:
 *
 * - **Size.** A phone photo is 4MB and a screenshot of a dashboard is 800KB;
 *   neither needs to be. Bounded at 2048px on the long edge they land in the
 *   low hundreds of KB, which is what makes an attachment store affordable
 *   without a second storage quota to enforce.
 * - **Sanitizing.** A SVG is XML and can carry script, so it is the one
 *   "image" that is not inert. Rasterizing it removes the question rather than
 *   answering it, and the same re-encode means every stored byte came out of
 *   sharp — which is why the download route can serve these inline.
 * - **Privacy.** sharp drops metadata unless asked to keep it, so EXIF goes
 *   with it. That matters more here than for a logo: these are the user's own
 *   photos, and a photo of a whiteboard carries the GPS coordinates of the
 *   room it was taken in.
 *
 * 2048px is chosen against the reader, not the disk. The entity-media pipeline
 * (`uploads/entity-media.ts`) caps at 800px, which is right for a logo and
 * unreadable for a screenshot of a dashboard — and unreadable to a vision
 * model too, when one is eventually pointed at these.
 */

import sharp from 'sharp';
import { DocumentExtractError } from './extract';

/**
 * Raw-upload cap for an image, well under the 100MB one the text path uses.
 *
 * Checked before the bytes reach a decoder, so it is also the first line
 * against a decompression bomb; `MAX_INPUT_PIXELS` is the second, because a
 * small file is free to claim enormous dimensions.
 */
export const MAX_MEDIA_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Long edge of the stored image, in pixels. */
const MAX_EDGE = 2048;

const WEBP_QUALITY = 80;

/** Refuse to decode beyond this, whatever the header claims. 50MP. */
const MAX_INPUT_PIXELS = 50_000_000;

/** SVG has no natural resolution; rasterize above 72dpi so text stays sharp. */
const SVG_DENSITY = 144;

export interface NormalizedImage {
	/** WebP bytes, ready to store. */
	bytes: Buffer;
	/** The upload's name with a `.webp` extension. */
	filename: string;
	width: number;
	height: number;
}

function basename(name: string): string {
	return name.split(/[\\/]/).pop() ?? name;
}

/** `report.png` → `report.webp`; a name without an extension just gains one. */
function webpName(filename: string): string {
	const base = basename(filename).trim() || 'image';
	const dot = base.lastIndexOf('.');
	return (dot > 0 ? base.slice(0, dot) : base) + '.webp';
}

/**
 * Re-encode one uploaded image to a bounded WebP.
 *
 * Throws `DocumentExtractError` on anything sharp refuses, so a bad image in a
 * multi-file upload is reported against its own filename and the rest of the
 * batch still lands — the same contract the text extractor has.
 */
export async function normalizeImage(input: {
	filename: string;
	bytes: Uint8Array;
}): Promise<NormalizedImage> {
	const buffer = Buffer.from(input.bytes);

	try {
		const probe = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();

		// An animated GIF or WebP is one image to the person who uploaded it, so
		// keep the frames. `animated` has to be decided before the pipeline is
		// built, and auto-rotate is not available once it is set — no loss, since
		// only cameras write the orientation tag and they do not write GIFs.
		const animated = (probe.pages ?? 1) > 1;
		const isVector = probe.format === 'svg';

		let pipeline = sharp(buffer, {
			limitInputPixels: MAX_INPUT_PIXELS,
			animated,
			...(isVector ? { density: SVG_DENSITY } : {})
		});
		if (!animated) pipeline = pipeline.rotate();

		// No `withMetadata()` anywhere in this chain, on purpose: that is what
		// drops EXIF, including the GPS tags a phone writes into every photo.
		const { data, info } = await pipeline
			.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
			.webp({ quality: WEBP_QUALITY })
			.toBuffer({ resolveWithObject: true });

		return {
			bytes: data,
			filename: webpName(input.filename),
			width: info.width,
			height: info.height
		};
	} catch (err) {
		if (err instanceof DocumentExtractError) throw err;
		const reason = err instanceof Error ? err.message : String(err);
		// Filename-free, like the other refusals here: the caller reports it
		// beside the name of the file that caused it.
		throw new DocumentExtractError(`Could not read the image: ${reason}`);
	}
}
