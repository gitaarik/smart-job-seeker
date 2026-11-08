/**
 * Renditions: upright, the right size, and under the platform's size limit.
 */
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { renderImage, storedRect } from '../render';
import { stripMetadataLossless } from '../strip-metadata';

/** 6x4 with a distinct value per pixel. */
async function tagged(orientation: number) {
	const width = 6;
	const height = 4;
	const raw = Buffer.alloc(width * height * 3);
	for (let i = 0; i < width * height; i++) {
		raw[i * 3] = i * 10;
		raw[i * 3 + 1] = 255 - i * 10;
		raw[i * 3 + 2] = (i * 37) % 256;
	}
	return sharp(raw, { raw: { width, height, channels: 3 } })
		.withMetadata({ orientation })
		.png()
		.toBuffer();
}

describe('orientation', () => {
	it.each([1, 2, 3, 4, 5, 6, 7, 8])(
		'orientation %i draws what sharp shows for the tagged original',
		async (orientation) => {
			const original = await tagged(orientation);
			// What a viewer shows: sharp's own EXIF auto-orient.
			const shown = await sharp(original).rotate().raw().toBuffer({ resolveWithObject: true });
			// The library stores the file without its EXIF and keeps the number.
			const stored = stripMetadataLossless(original, 'png');
			const { width, height } = shown.info;
			const drawn = await renderImage(
				{ original: stored, format: 'png', orientation, width, height },
				{ crop: { x: 0, y: 0, w: width, h: height }, width, height, format: 'png' }
			);
			const out = await sharp(drawn.bytes).raw().toBuffer({ resolveWithObject: true });
			expect([out.info.width, out.info.height]).toEqual([width, height]);
			expect(out.data.equals(shown.data)).toBe(true);
		}
	);

	it.each([1, 2, 3, 4, 5, 6, 7, 8])(
		'a crop of orientation %i is the same crop of what is shown',
		async (orientation) => {
			const original = await tagged(orientation);
			const shown = await sharp(original).rotate().toBuffer({ resolveWithObject: true });
			const { width, height } = shown.info;
			const crop = { x: 1, y: 1, w: 2, h: 2 };
			const expected = await sharp(shown.data)
				.extract({ left: 1, top: 1, width: 2, height: 2 })
				.raw()
				.toBuffer();
			const drawn = await renderImage(
				{
					original: stripMetadataLossless(original, 'png'),
					format: 'png',
					orientation,
					width,
					height
				},
				{ crop, width: 2, height: 2, format: 'png' }
			);
			expect((await sharp(drawn.bytes).raw().toBuffer()).equals(expected)).toBe(true);
		}
	);

	it('maps an upright crop onto the stored pixels', () => {
		// Stored 6x4, shown 4x6 when rotated a quarter turn (6).
		expect(storedRect({ x: 0, y: 0, w: 4, h: 1 }, 6, 6, 4)).toEqual({
			left: 0,
			top: 0,
			width: 1,
			height: 4
		});
		expect(storedRect({ x: 1, y: 2, w: 2, h: 3 }, 1, 6, 4)).toEqual({
			left: 1,
			top: 2,
			width: 2,
			height: 3
		});
	});
});

describe('size and file size', () => {
	async function photo() {
		// Noise compresses badly, which is what makes the size limit bite.
		const raw = Buffer.alloc(800 * 800 * 3);
		for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) % 251;
		return sharp(raw, { raw: { width: 800, height: 800, channels: 3 } })
			.png()
			.toBuffer();
	}

	it('draws at exactly the preset size', async () => {
		const original = await photo();
		const drawn = await renderImage(
			{ original, format: 'png', orientation: 1, width: 800, height: 800 },
			{ crop: { x: 0, y: 200, w: 800, h: 400 }, width: 400, height: 200, format: 'jpeg' }
		);
		const meta = await sharp(drawn.bytes).metadata();
		expect([meta.width, meta.height, meta.format]).toEqual([400, 200, 'jpeg']);
	});

	it('lowers the quality until the file fits the limit', async () => {
		const original = await photo();
		const input = { original, format: 'png' as const, orientation: 1, width: 800, height: 800 };
		const target = {
			crop: { x: 0, y: 0, w: 800, h: 800 },
			width: 400,
			height: 400,
			format: 'jpeg' as const
		};
		// What the top quality weighs, and a limit two thirds of that.
		const top = await renderImage(input, { ...target, maxBytes: Number.MAX_SAFE_INTEGER });
		expect(top.quality).toBe(92);
		const limit = Math.round(top.bytes.length * 0.66);
		const drawn = await renderImage(input, { ...target, maxBytes: limit });
		expect(drawn.fits).toBe(true);
		expect(drawn.bytes.length).toBeLessThanOrEqual(limit);
		expect(drawn.quality).toBeLessThan(92);
	});

	it('says so when no quality fits', async () => {
		const original = await photo();
		const drawn = await renderImage(
			{ original, format: 'png', orientation: 1, width: 800, height: 800 },
			{
				crop: { x: 0, y: 0, w: 800, h: 800 },
				width: 800,
				height: 800,
				format: 'jpeg',
				maxBytes: 2_000
			}
		);
		expect(drawn.fits).toBe(false);
	});

	it('flattens transparency onto white for a JPEG', async () => {
		const original = await sharp({
			create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
		})
			.png()
			.toBuffer();
		const drawn = await renderImage(
			{ original, format: 'png', orientation: 1, width: 4, height: 4 },
			{ crop: { x: 0, y: 0, w: 4, h: 4 }, width: 4, height: 4, format: 'jpeg' }
		);
		const { data } = await sharp(drawn.bytes).raw().toBuffer({ resolveWithObject: true });
		expect(Math.min(...data)).toBeGreaterThan(240);
	});

	it('rasterizes an SVG sharp at the size asked for', async () => {
		const svg = Buffer.from(
			'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>'
		);
		const drawn = await renderImage(
			{ original: svg, format: 'svg', orientation: 1, width: 10, height: 10 },
			{ crop: { x: 0, y: 0, w: 10, h: 10 }, width: 400, height: 400, format: 'png' }
		);
		const meta = await sharp(drawn.bytes).metadata();
		expect([meta.width, meta.height]).toEqual([400, 400]);
	});
});
