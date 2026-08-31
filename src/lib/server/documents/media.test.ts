/**
 * The image path: what gets in, and what comes out the other side.
 *
 * The assertions worth having here are the three the re-encode exists for —
 * bounded size, no EXIF, no SVG left as SVG — because each is a property of
 * the *stored* bytes rather than of the code that produced them, and each
 * would fail silently. An image that keeps its GPS tags still renders.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { normalizeImage } from './media';
import { DocumentExtractError } from './extract';
import { extOf, sniffUploadKind } from './sniff';

/** A solid-colour PNG of the given size. */
async function png(width: number, height: number): Promise<Uint8Array> {
	const buf = await sharp({
		create: { width, height, channels: 3, background: { r: 200, g: 60, b: 60 } }
	})
		.png()
		.toBuffer();
	return new Uint8Array(buf);
}

const enc = (s: string) => new TextEncoder().encode(s);

const SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#333"/></svg>';

describe('normalizeImage', () => {
	it('re-encodes to WebP whatever came in', async () => {
		const out = await normalizeImage({ filename: 'shot.png', bytes: await png(100, 80) });
		const meta = await sharp(out.bytes).metadata();
		expect(meta.format).toBe('webp');
		expect(out.filename).toBe('shot.webp');
	});

	it('bounds the long edge without enlarging a small one', async () => {
		const big = await normalizeImage({ filename: 'wide.png', bytes: await png(4000, 1000) });
		expect(big.width).toBe(2048);
		expect(big.height).toBe(512);

		const small = await normalizeImage({ filename: 'tiny.png', bytes: await png(64, 64) });
		expect(small.width).toBe(64);
		expect(small.height).toBe(64);
	});

	it('drops EXIF, which is where a phone writes the location', async () => {
		const withExif = await sharp({
			create: { width: 40, height: 40, channels: 3, background: '#123456' }
		})
			.withExif({ IFD0: { Copyright: 'somebody', Software: 'a camera' } })
			.jpeg()
			.toBuffer();
		// The fixture has to actually carry what we claim to strip.
		expect((await sharp(withExif).metadata()).exif).toBeDefined();

		const out = await normalizeImage({ filename: 'photo.jpg', bytes: new Uint8Array(withExif) });
		expect((await sharp(out.bytes).metadata()).exif).toBeUndefined();
	});

	it('rasterizes an SVG, so no markup survives to be served back', async () => {
		const out = await normalizeImage({ filename: 'logo.svg', bytes: enc(SVG) });
		const meta = await sharp(out.bytes).metadata();
		expect(meta.format).toBe('webp');
		expect(out.bytes.subarray(0, 200).toString('utf8')).not.toContain('<svg');
	});

	it('keeps the frames of an animated GIF', async () => {
		// A fixture on disk because sharp cannot build one: `create` makes a still,
		// and animated output needs input that already has pages. Two 8x8 frames,
		// made with `ffmpeg -f lavfi -i color=...` (see fixtures/).
		const frames = readFileSync(join(import.meta.dirname, 'fixtures/animated.gif'));
		expect((await sharp(frames, { animated: true }).metadata()).pages).toBe(2);

		const out = await normalizeImage({ filename: 'loop.gif', bytes: new Uint8Array(frames) });
		expect((await sharp(out.bytes, { animated: true }).metadata()).pages).toBe(2);
	});

	it('reports a file it cannot decode as an extract error', async () => {
		await expect(
			normalizeImage({ filename: 'broken.png', bytes: enc('not an image at all') })
		).rejects.toBeInstanceOf(DocumentExtractError);
	});
});

/**
 * Classification is what decides which of the two paths a file takes, so the
 * cases that matter are the disagreements between name and content.
 */
describe('sniffUploadKind on images', () => {
	it('calls a real image media', async () => {
		expect(sniffUploadKind(await png(8, 8), 'a.png')).toBe('media');
	});

	it('accepts a mislabeled image, since the bytes are what gets re-encoded', async () => {
		expect(sniffUploadKind(await png(8, 8), 'a.jpg')).toBe('media');
	});

	it('refuses an image body under a non-image name', async () => {
		expect(sniffUploadKind(await png(8, 8), 'setup.exe')).toBe('unknown');
	});

	it('refuses an image name over something that is not one', () => {
		expect(sniffUploadKind(enc('#!/bin/sh\necho hi\n'), 'evil.png')).toBe('unknown');
	});

	it('takes an SVG on its extension, being genuinely text', () => {
		expect(sniffUploadKind(enc(SVG), 'logo.svg')).toBe('media');
	});

	it('still classifies text and archives as before', () => {
		expect(sniffUploadKind(enc('const x = 1'), 'a.ts')).toBe('text');
		expect(extOf('A.PNG')).toBe('png');
	});
});
