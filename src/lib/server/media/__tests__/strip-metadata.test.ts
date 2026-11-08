/**
 * An original keeps its pixels and loses its metadata.
 *
 * The property the media library rests on (planning/MEDIA-LIBRARY.md,
 * decision 2): what is stored decodes to exactly the pixels that were
 * uploaded, and nothing that names a place, a camera or an author survives.
 * Each fixture is written by sharp with the metadata a phone or an editor
 * would add, so the assertions run against real file structures.
 */
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { stripMetadataLossless } from '../strip-metadata';
import { prepareOriginal, sniffFormat, MediaUploadError } from '../originals';

const XMP = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Someone</dc:creator></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;

const EXIF = {
	IFD0: { Make: 'PhoneMaker', Model: 'Phone 9', Copyright: 'Someone' },
	IFD3: {
		GPSLatitudeRef: 'N',
		GPSLatitude: '52/1 22/1 0/1',
		GPSLongitudeRef: 'E',
		GPSLongitude: '4/1 53/1 0/1'
	}
};

/** A 64x48 picture with a different value in every pixel, so a shift or a flip shows. */
function base(channels: 3 | 4 = 3) {
	const width = 64;
	const height = 48;
	const raw = Buffer.alloc(width * height * channels);
	for (let i = 0; i < width * height; i++) {
		raw[i * channels] = (i * 7) % 256;
		raw[i * channels + 1] = (i * 13) % 256;
		raw[i * channels + 2] = (i * 29) % 256;
		if (channels === 4) raw[i * channels + 3] = 128 + (i % 128);
	}
	return sharp(raw, { raw: { width, height, channels } });
}

/** The pixels as stored, without applying any orientation or colour profile. */
async function pixels(bytes: Buffer) {
	return sharp(bytes, { ignoreIcc: true }).raw().toBuffer();
}

async function metadataOf(bytes: Buffer) {
	const meta = await sharp(bytes).metadata();
	return {
		exif: !!meta.exif,
		xmp: !!meta.xmp,
		iptc: !!meta.iptc,
		icc: !!meta.icc,
		comments: meta.comments?.length ?? 0
	};
}

describe('a JPEG', () => {
	it('loses EXIF (GPS, camera) and XMP, keeps its colour profile, and decodes to the same pixels', async () => {
		const input = await base()
			.withExif(EXIF)
			.withXmp(XMP)
			.withIccProfile('p3')
			.jpeg({ quality: 90 })
			.toBuffer();
		expect(await metadataOf(input)).toMatchObject({ exif: true, xmp: true, icc: true });

		const out = stripMetadataLossless(input, 'jpeg');
		expect(await metadataOf(out)).toEqual({
			exif: false,
			xmp: false,
			iptc: false,
			icc: true,
			comments: 0
		});
		expect((await pixels(out)).equals(await pixels(input))).toBe(true);
		expect(out.length).toBeLessThan(input.length);
	});

	it('drops what follows the end marker, where a phone keeps a second picture', async () => {
		const input = await base().jpeg().toBuffer();
		const trailer = await base().withExif(EXIF).jpeg().toBuffer();
		const out = stripMetadataLossless(Buffer.concat([input, trailer]), 'jpeg');
		expect(out.equals(input)).toBe(true);
	});

	it('takes the thumbnail out of a JFIF header but keeps the header', async () => {
		const input = await base().jpeg().toBuffer();
		// Splice a JFIF APP0 with a 1x1 thumbnail in after the SOI marker.
		const payload = Buffer.concat([
			Buffer.from('JFIF\0', 'latin1'),
			Buffer.from([1, 2, 0, 0, 1, 0, 1, 1, 1]),
			Buffer.from([255, 0, 0])
		]);
		const app0 = Buffer.concat([Buffer.from([0xff, 0xe0]), Buffer.alloc(2), payload]);
		app0.writeUInt16BE(payload.length + 2, 2);
		const withThumb = Buffer.concat([input.subarray(0, 2), app0, input.subarray(2)]);
		const out = stripMetadataLossless(withThumb, 'jpeg');
		expect(out.includes(Buffer.from([255, 0, 0, 0xff]))).toBe(false);
		expect(out.includes(Buffer.from('JFIF\0', 'latin1'))).toBe(true);
		expect((await pixels(out)).equals(await pixels(input))).toBe(true);
	});

	it('refuses a file that is not one', () => {
		expect(() => stripMetadataLossless(Buffer.from('not a jpeg'), 'jpeg')).toThrow();
	});
});

describe('a PNG', () => {
	it('loses EXIF, XMP and text, keeps transparency and its profile, same pixels', async () => {
		const input = await base(4).withExif(EXIF).withXmp(XMP).withIccProfile('p3').png().toBuffer();
		expect(await metadataOf(input)).toMatchObject({ exif: true, xmp: true, icc: true });

		const out = stripMetadataLossless(input, 'png');
		expect(await metadataOf(out)).toEqual({
			exif: false,
			xmp: false,
			iptc: false,
			icc: true,
			comments: 0
		});
		expect((await sharp(out).metadata()).hasAlpha).toBe(true);
		expect((await pixels(out)).equals(await pixels(input))).toBe(true);
	});

	it('keeps a palette PNG a palette PNG', async () => {
		const input = await base(4).png({ palette: true }).toBuffer();
		const out = stripMetadataLossless(input, 'png');
		expect((await sharp(out).metadata()).isPalette).toBe(true);
		expect((await pixels(out)).equals(await pixels(input))).toBe(true);
	});
});

describe('a WebP', () => {
	it('loses EXIF and XMP and their flags, same pixels', async () => {
		for (const options of [{ lossless: true }, { quality: 80 }]) {
			const input = await base().withExif(EXIF).withXmp(XMP).webp(options).toBuffer();
			expect(await metadataOf(input)).toMatchObject({ exif: true, xmp: true });

			const out = stripMetadataLossless(input, 'webp');
			expect(await metadataOf(out)).toMatchObject({ exif: false, xmp: false });
			expect((await pixels(out)).equals(await pixels(input))).toBe(true);
			// RIFF size matches the file.
			expect(out.readUInt32LE(4) + 8).toBe(out.length);
		}
	});
});

describe('a GIF', () => {
	it('loses comment blocks, same pixels', async () => {
		const input = await base().gif().toBuffer();
		// A comment extension after the colour table, the way editors write one.
		const comment = Buffer.concat([
			Buffer.from([0x21, 0xfe, 5]),
			Buffer.from('hello'),
			Buffer.from([0])
		]);
		const packed = input[10];
		const tableEnd = 13 + (packed & 0x80 ? 3 * 2 ** ((packed & 7) + 1) : 0);
		const withComment = Buffer.concat([
			input.subarray(0, tableEnd),
			comment,
			input.subarray(tableEnd)
		]);
		const out = stripMetadataLossless(withComment, 'gif');
		expect(out.includes(Buffer.from('hello'))).toBe(false);
		expect((await pixels(out)).equals(await pixels(input))).toBe(true);
	});
});

describe('an SVG', () => {
	it('loses its metadata element and comments', () => {
		const svg = `<?xml version="1.0"?><!-- made by someone --><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><metadata><rdf:RDF>author</rdf:RDF></metadata><rect width="10" height="10"/></svg>`;
		const out = stripMetadataLossless(Buffer.from(svg), 'svg').toString();
		expect(out).not.toContain('someone');
		expect(out).not.toContain('author');
		expect(out).toContain('<rect');
	});
});

describe('prepareOriginal', () => {
	it('keeps the orientation as a number and the stored pixels as they were', async () => {
		const input = await base().withMetadata({ orientation: 6 }).withExif(EXIF).jpeg().toBuffer();
		const prepared = await prepareOriginal(input);
		expect(prepared.orientation).toBe(6);
		// Sideways as stored, so upright it is 48 wide and 64 tall.
		expect([prepared.width, prepared.height]).toEqual([48, 64]);
		expect((await pixels(prepared.bytes)).equals(await pixels(input))).toBe(true);
		expect(await metadataOf(prepared.bytes)).toMatchObject({ exif: false, xmp: false });
	});

	it('stores an AVIF as a lossless PNG of the same picture', async () => {
		const input = await base().avif({ lossless: true }).toBuffer();
		expect(sniffFormat(input)).toBe('avif');
		const prepared = await prepareOriginal(input);
		expect(prepared.format).toBe('png');
		const decoded = await sharp(input).raw().toBuffer();
		expect((await sharp(prepared.bytes).raw().toBuffer()).equals(decoded)).toBe(true);
	});

	it('refuses HEIC with what to do instead', async () => {
		const ftyp = Buffer.alloc(24);
		ftyp.writeUInt32BE(24, 0);
		ftyp.write('ftypheic', 4, 'latin1');
		ftyp.write('mif1heic', 16, 'latin1');
		expect(sniffFormat(ftyp)).toBe('heic');
		await expect(prepareOriginal(ftyp)).rejects.toThrow(/JPEG/);
		await expect(prepareOriginal(ftyp)).rejects.toBeInstanceOf(MediaUploadError);
	});

	it('refuses what is not an image', async () => {
		await expect(prepareOriginal(Buffer.from('%PDF-1.7 hello'))).rejects.toBeInstanceOf(
			MediaUploadError
		);
	});
});
