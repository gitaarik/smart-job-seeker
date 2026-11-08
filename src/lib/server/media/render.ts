/**
 * Drawing a rendition: a crop of an original, at a size, in a format, small
 * enough for the platform.
 *
 * The original is stored as uploaded, which includes being stored sideways:
 * its EXIF went with the rest of its metadata, and the orientation it carried
 * lives on the item instead. A crop is chosen on the upright picture, so it
 * is mapped back onto the stored pixels, cut and scaled there, and only the
 * small result is turned upright. Turning the whole original first would mean
 * decoding and rotating a 24-megapixel photo to cut a 400px square out of it.
 */

import sharp, { type Sharp, type SharpOptions } from 'sharp';
import type { Crop, OutputFormat } from '$lib/media-library';
import { MAX_ORIGINAL_PIXELS, type StoredFormat } from './originals';

export interface RenderInput {
	original: Buffer;
	format: StoredFormat;
	orientation: number;
	/** The item's upright size, which is what `crop` is measured against. */
	width: number;
	height: number;
}

export interface RenderTarget {
	crop: Crop;
	width: number;
	height: number;
	format: OutputFormat;
	/** The platform's file size limit; null when it has none. */
	maxBytes?: number | null;
	/** Quality to use when there is no limit to fit. */
	quality?: number;
}

export interface RenderedImage {
	bytes: Buffer;
	/** The quality it settled on; null for a lossless PNG. */
	quality: number | null;
	/** False when even the lowest quality is over `maxBytes`. */
	fits: boolean;
}

/** The stored rectangle under an upright crop, for each EXIF orientation. */
export function storedRect(
	crop: Crop,
	orientation: number,
	storedWidth: number,
	storedHeight: number
): { left: number; top: number; width: number; height: number } {
	const W = storedWidth;
	const H = storedHeight;
	const { x, y, w, h } = crop;
	switch (orientation) {
		case 2:
			return { left: W - x - w, top: y, width: w, height: h };
		case 3:
			return { left: W - x - w, top: H - y - h, width: w, height: h };
		case 4:
			return { left: x, top: H - y - h, width: w, height: h };
		case 5:
			return { left: y, top: x, width: h, height: w };
		case 6:
			return { left: y, top: H - x - w, width: h, height: w };
		case 7:
			return { left: W - y - h, top: H - x - w, width: h, height: w };
		case 8:
			return { left: W - y - h, top: x, width: h, height: w };
		default:
			return { left: x, top: y, width: w, height: h };
	}
}

/**
 * Turn stored pixels upright. sharp applies flip and flop before any rotation,
 * whatever order they are called in, which is why 5 and 7 read the way they
 * do; the tests compare all eight with sharp's own EXIF auto-orient.
 */
export function orient(pipeline: Sharp, orientation: number): Sharp {
	switch (orientation) {
		case 2:
			return pipeline.flop();
		case 3:
			return pipeline.rotate(180);
		case 4:
			return pipeline.flip();
		case 5:
			return pipeline.flip().rotate(90);
		case 6:
			return pipeline.rotate(90);
		case 7:
			return pipeline.flop().rotate(90);
		case 8:
			return pipeline.rotate(270);
		default:
			return pipeline;
	}
}

/** SVG has no pixels of its own; rasterize it dense enough for the target, within reason. */
const SVG_MAX_DENSITY = 2400;

const JPEG_QUALITIES = [92, 88, 84, 80, 75, 70, 65, 60, 50, 40];
const PNG_PALETTE_QUALITIES = [90, 75, 60, 40];
const DEFAULT_QUALITY = 88;

async function encode(
	pipeline: Sharp,
	format: OutputFormat,
	maxBytes: number | null,
	quality: number
): Promise<RenderedImage> {
	if (format === 'png') {
		const lossless = await pipeline.clone().png({ compressionLevel: 9 }).toBuffer();
		if (!maxBytes || lossless.length <= maxBytes)
			return { bytes: lossless, quality: null, fits: true };
		let last = lossless;
		let lastQuality = 0;
		for (const q of PNG_PALETTE_QUALITIES) {
			last = await pipeline
				.clone()
				.png({ palette: true, quality: q, compressionLevel: 9 })
				.toBuffer();
			lastQuality = q;
			if (last.length <= maxBytes) return { bytes: last, quality: q, fits: true };
		}
		return { bytes: last, quality: lastQuality, fits: false };
	}

	const write = (q: number) =>
		format === 'jpeg'
			? pipeline.clone().jpeg({ quality: q, mozjpeg: true }).toBuffer()
			: pipeline.clone().webp({ quality: q }).toBuffer();

	if (!maxBytes) return { bytes: await write(quality), quality, fits: true };
	let last = await write(JPEG_QUALITIES[0]);
	let lastQuality = JPEG_QUALITIES[0];
	for (const q of JPEG_QUALITIES) {
		if (q !== lastQuality) {
			last = await write(q);
			lastQuality = q;
		}
		if (last.length <= maxBytes) return { bytes: last, quality: q, fits: true };
	}
	return { bytes: last, quality: lastQuality, fits: false };
}

/**
 * Draw one rendition. Pure: bytes in, bytes out, nothing stored.
 *
 * Throws if the crop falls outside the picture; callers clamp crops when they
 * are saved (`clampCrop`), so a throw here is a bug, not a user error.
 */
export async function renderImage(
	input: RenderInput,
	target: RenderTarget
): Promise<RenderedImage> {
	const sideways = input.orientation >= 5;
	const storedWidth = sideways ? input.height : input.width;
	const storedHeight = sideways ? input.width : input.height;
	let rect = storedRect(target.crop, input.orientation, storedWidth, storedHeight);
	const outWidth = sideways ? target.height : target.width;
	const outHeight = sideways ? target.width : target.height;

	const options: SharpOptions = { limitInputPixels: MAX_ORIGINAL_PIXELS };
	if (input.format === 'svg') {
		// The item's size is the SVG's own (at 72dpi). Rasterize at whatever
		// density makes the crop at least as big as the output, and scale the
		// crop by the same factor.
		const scale = Math.max(1, target.width / target.crop.w, target.height / target.crop.h);
		const density = Math.min(SVG_MAX_DENSITY, 72 * scale);
		options.density = density;
		const raster = await sharp(input.original, options).metadata();
		const fx = (raster.width ?? storedWidth) / storedWidth;
		const fy = (raster.height ?? storedHeight) / storedHeight;
		const left = Math.floor(rect.left * fx);
		const top = Math.floor(rect.top * fy);
		rect = {
			left,
			top,
			width: Math.max(1, Math.min((raster.width ?? 1) - left, Math.round(rect.width * fx))),
			height: Math.max(1, Math.min((raster.height ?? 1) - top, Math.round(rect.height * fy)))
		};
	}

	let pipeline = sharp(input.original, options)
		.extract(rect)
		.resize(outWidth, outHeight, { fit: 'fill' });

	if (input.orientation !== 1) {
		// A lossless hand-over between the two steps, at the output's size.
		const cut = await pipeline.png({ compressionLevel: 0 }).toBuffer();
		pipeline = orient(sharp(cut), input.orientation);
	}
	if (target.format === 'jpeg') pipeline = pipeline.flatten({ background: '#ffffff' });

	return encode(
		pipeline,
		target.format,
		target.maxBytes ?? null,
		target.quality ?? DEFAULT_QUALITY
	);
}

/**
 * The upright original scaled to fit inside `maxEdge`, for the crop editor and
 * the grid. WebP, since only the owner's own browser ever sees it.
 */
export async function renderPreview(input: RenderInput, maxEdge: number): Promise<Buffer> {
	const scale = Math.min(1, maxEdge / Math.max(input.width, input.height));
	const width = Math.max(1, Math.round(input.width * scale));
	const height = Math.max(1, Math.round(input.height * scale));
	const { bytes } = await renderImage(input, {
		crop: { x: 0, y: 0, w: input.width, h: input.height },
		width,
		height,
		format: 'webp',
		quality: 82
	});
	return bytes;
}
