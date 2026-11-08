/**
 * Images on their way to a public route.
 *
 * The property these exist for is one nobody can see: an image that keeps its
 * GPS tags still renders. So every case asserts on the bytes that would be
 * served, and every fixture first proves it carries what is meant to go.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { processEntityImage, stripImageMetadata } from '../public-image';

/** EXIF the way a phone writes it: the camera, and where it stood. */
const PHONE_EXIF = {
	IFD0: { Make: 'TestPhone', Model: 'X1' },
	IFD3: {
		GPSLatitudeRef: 'N',
		GPSLatitude: '52/1 22/1 1/1',
		GPSLongitudeRef: 'E',
		GPSLongitude: '4/1 53/1 1/1'
	}
};

type Format = 'jpeg' | 'png' | 'webp';

/** A small image carrying a phone's EXIF, location included. */
async function phonePhoto(
	format: Format,
	{ width = 60, height = 40, alpha = false } = {}
): Promise<Buffer> {
	const base = sharp({
		create: {
			width,
			height,
			channels: alpha ? 4 : 3,
			background: alpha ? { r: 20, g: 120, b: 200, alpha: 0.5 } : { r: 20, g: 120, b: 200 }
		}
	}).withExif(PHONE_EXIF);
	const bytes = await (
		format === 'jpeg' ? base.jpeg() : format === 'png' ? base.png() : base.webp()
	).toBuffer();
	// The fixture has to carry what the code under test claims to remove.
	expect((await sharp(bytes).metadata()).exif).toBeDefined();
	return bytes;
}

/** Pixel values as stored, read without colour management. */
async function storedPixels(bytes: Buffer): Promise<Buffer> {
	return sharp(bytes, { ignoreIcc: true }).raw().toBuffer();
}

describe('processEntityImage', () => {
	it('drops the EXIF of a phone photo, location and all', async () => {
		const out = await processEntityImage(await phonePhoto('jpeg'), 'image/jpeg');
		const meta = await sharp(out.bytes).metadata();
		expect(out.ext).toBe('.jpg');
		expect(meta.exif).toBeUndefined();
	});

	it('still fits it inside 800x800 without enlarging a small one', async () => {
		const big = await processEntityImage(
			await phonePhoto('jpeg', { width: 1600, height: 1200 }),
			'image/jpeg'
		);
		const bigMeta = await sharp(big.bytes).metadata();
		expect([bigMeta.width, bigMeta.height]).toEqual([800, 600]);

		const small = await processEntityImage(await phonePhoto('jpeg'), 'image/jpeg');
		const smallMeta = await sharp(small.bytes).metadata();
		expect([smallMeta.width, smallMeta.height]).toEqual([60, 40]);
	});

	it('keeps a transparent PNG a PNG, without its EXIF', async () => {
		const out = await processEntityImage(await phonePhoto('png', { alpha: true }), 'image/png');
		const meta = await sharp(out.bytes).metadata();
		expect(out.ext).toBe('.png');
		expect(meta.hasAlpha).toBe(true);
		expect(meta.exif).toBeUndefined();
	});
});

describe('stripImageMetadata', () => {
	it('drops the EXIF of a JPEG and keeps its size and format', async () => {
		const out = await stripImageMetadata(await phonePhoto('jpeg'));
		const meta = await sharp(out).metadata();
		expect(meta.exif).toBeUndefined();
		expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 60, 40]);
	});

	it('keeps a PNG lossless and its colour profile, pixel values included', async () => {
		const input = await sharp({
			create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 255, b: 0 } }
		})
			.withIccProfile('p3')
			.withExif(PHONE_EXIF)
			.png()
			.toBuffer();
		expect((await sharp(input).metadata()).exif).toBeDefined();

		const out = await stripImageMetadata(input);
		const meta = await sharp(out).metadata();
		expect(meta.exif).toBeUndefined();
		expect(meta.icc).toBeDefined();
		expect((await storedPixels(out)).equals(await storedPixels(input))).toBe(true);
	});

	it('keeps a palette PNG a palette PNG, pixel for pixel', async () => {
		// What processEntityImage writes: `png({ quality })` quantizes.
		const busy = Buffer.from(Array.from({ length: 64 * 64 * 3 }, (_, i) => (i * 97) % 256));
		const input = await sharp(busy, { raw: { width: 64, height: 64, channels: 3 } })
			.withExif(PHONE_EXIF)
			.png({ quality: 85 })
			.toBuffer();
		expect((await sharp(input).metadata()).isPalette).toBe(true);

		const out = await stripImageMetadata(input);
		const meta = await sharp(out).metadata();
		expect(meta.exif).toBeUndefined();
		expect(meta.isPalette).toBe(true);
		expect((await storedPixels(out)).equals(await storedPixels(input))).toBe(true);
	});

	it('keeps a lossless WebP lossless', async () => {
		// Busy pixels, so a lossy re-encode could not pass for a lossless one the
		// way a flat colour can.
		const busy = Buffer.from(Array.from({ length: 32 * 32 * 3 }, (_, i) => (i * 97) % 256));
		const input = await sharp(busy, { raw: { width: 32, height: 32, channels: 3 } })
			.withExif(PHONE_EXIF)
			.webp({ lossless: true })
			.toBuffer();
		expect((await sharp(input).metadata()).exif).toBeDefined();

		const out = await stripImageMetadata(input);
		expect((await sharp(out).metadata()).exif).toBeUndefined();
		expect((await storedPixels(out)).equals(await storedPixels(input))).toBe(true);
	});

	it('drops the EXIF of a lossy WebP', async () => {
		const out = await stripImageMetadata(await phonePhoto('webp'));
		const meta = await sharp(out).metadata();
		expect(meta.format).toBe('webp');
		expect(meta.exif).toBeUndefined();
	});

	it('turns a photo upright before its orientation tag goes', async () => {
		const sideways = await sharp({
			create: { width: 30, height: 10, channels: 3, background: '#c33' }
		})
			.withMetadata({ orientation: 6 })
			.jpeg()
			.toBuffer();
		expect((await sharp(sideways).metadata()).orientation).toBe(6);

		const meta = await sharp(await stripImageMetadata(sideways)).metadata();
		expect([meta.width, meta.height]).toEqual([10, 30]);
		expect(meta.orientation).toBeUndefined();
		expect(meta.exif).toBeUndefined();
	});

	it('returns a clean image as it came, without re-encoding it', async () => {
		const clean = await sharp({
			create: { width: 8, height: 8, channels: 3, background: '#123456' }
		})
			.jpeg()
			.toBuffer();
		expect(await stripImageMetadata(clean)).toBe(clean);
	});

	it('leaves the frames of an animated GIF alone when it carries nothing', async () => {
		const frames = readFileSync(join(import.meta.dirname, '../../documents/fixtures/animated.gif'));
		const out = await stripImageMetadata(frames);
		expect((await sharp(out, { animated: true }).metadata()).pages).toBe(2);
	});

	it('passes through what is not a raster image', async () => {
		const font = Buffer.from('wOFF\u0000\u0001\u0000\u0000 not an image');
		expect(await stripImageMetadata(font)).toBe(font);
	});

	it('throws on an image it cannot decode, rather than storing it raw', async () => {
		// Header and EXIF intact, the end of the picture missing: a broken upload
		// that still names the phone. Busy pixels, so there is a picture long
		// enough to cut into without reaching the tables in front of it.
		const busy = Buffer.from(Array.from({ length: 200 * 200 * 3 }, (_, i) => (i * 97) % 256));
		const whole = await sharp(busy, { raw: { width: 200, height: 200, channels: 3 } })
			.withExif(PHONE_EXIF)
			.jpeg()
			.toBuffer();
		const truncated = whole.subarray(0, Math.floor(whole.length / 2));
		expect((await sharp(truncated).metadata()).exif).toBeDefined();
		await expect(stripImageMetadata(truncated)).rejects.toThrow();
	});
});
