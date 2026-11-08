/**
 * Metadata out, pixels untouched.
 *
 * A media library original is the one copy of a picture that must not be
 * re-encoded: every rendition is cut from it, and a lossy save would be a
 * second generation baked into all of them. So where `public-image.ts` lets
 * sharp re-encode a JPEG once to drop its EXIF, this cuts the metadata out of
 * the file's structure by hand and leaves the compressed image data exactly as
 * it was. The pixels decode to the same values, which the tests check.
 *
 * Each format keeps an allowlist of what it needs to be decoded and shown
 * correctly, and drops everything else. An allowlist and not a list of known
 * metadata, for the reason `/assets/[id]` gives about its own: forgetting a
 * harmless block costs a few bytes, forgetting a GPS-carrying one publishes a
 * location.
 *
 * - JPEG: keeps the coding segments, the JFIF header (with any thumbnail
 *   taken out of it), the colour profile (APP2 `ICC_PROFILE`) and the Adobe
 *   segment, which says how the colour channels are encoded. Drops EXIF and
 *   XMP (APP1), IPTC (APP13), comments, MPF, content credentials and every
 *   other APPn. Stops after the image's end marker, which is where phones put
 *   a second picture (an HDR gain map or a depth map) with its own EXIF.
 * - PNG: keeps every critical chunk and the ancillary ones that change how it
 *   looks (transparency, gamma, colour profile, HDR, animation). Drops text
 *   (where XMP lives), `eXIf`, `tIME` and anything unknown.
 * - WebP: keeps the image, alpha, animation and colour profile chunks, drops
 *   `EXIF` and `XMP ` and clears their flags in `VP8X`.
 * - GIF: drops comment blocks and application blocks other than the looping
 *   ones (XMP rides in an application block).
 * - SVG: drops `<metadata>` elements and comments. An SVG original is private
 *   and never served as itself, only rasterized, so this is about what an
 *   export carries rather than what a page shows.
 *
 * The orientation tag goes with the EXIF. It is read first (by `inspect`) and
 * kept on the item, and every rendition applies it.
 */

export class MetadataStripError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MetadataStripError';
	}
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** The formats this file can clean without re-encoding. */
export type StrippableFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'svg';

export function stripMetadataLossless(bytes: Buffer, format: StrippableFormat): Buffer {
	switch (format) {
		case 'jpeg':
			return stripJpeg(bytes);
		case 'png':
			return stripPng(bytes);
		case 'webp':
			return stripWebp(bytes);
		case 'gif':
			return stripGif(bytes);
		case 'svg':
			return Buffer.from(stripSvg(bytes.toString('utf8')), 'utf8');
	}
}

// --- JPEG -------------------------------------------------------------------

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const APP0 = 0xe0;
const APP2 = 0xe2;
const APP14 = 0xee;
const COM = 0xfe;

function startsWith(payload: Buffer, ascii: string): boolean {
	return payload.length >= ascii.length && payload.toString('latin1', 0, ascii.length) === ascii;
}

/**
 * The segment to write in place of this one, or null to drop it.
 *
 * Only APPn and COM are ever dropped. Everything else is image data: tables,
 * frame and scan headers, restart intervals.
 */
function keptJpegSegment(marker: number, segment: Buffer): Buffer | null {
	const payload = segment.subarray(4);
	if (marker === COM) return null;
	if (marker < APP0 || marker > 0xef) return segment;

	if (marker === APP0) {
		if (!startsWith(payload, 'JFIF\0')) return null; // JFXX: an extension holding only a thumbnail
		// identifier(5) version(2) units(1) density(4), then a thumbnail's
		// width and height and its pixels. Keep the header, drop the thumbnail:
		// it is a second, smaller copy of the picture, as it was before any edit.
		if (payload.length <= 14) return segment;
		const header = Buffer.from(payload.subarray(0, 14));
		header[12] = 0;
		header[13] = 0;
		const out = Buffer.alloc(4 + header.length);
		out[0] = 0xff;
		out[1] = APP0;
		out.writeUInt16BE(header.length + 2, 2);
		header.copy(out, 4);
		return out;
	}
	if (marker === APP2) return startsWith(payload, 'ICC_PROFILE\0') ? segment : null;
	if (marker === APP14) return startsWith(payload, 'Adobe') ? segment : null;
	return null;
}

function stripJpeg(bytes: Buffer): Buffer {
	if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) {
		throw new MetadataStripError('Not a JPEG.');
	}
	const out: Buffer[] = [bytes.subarray(0, 2)];
	let at = 2;

	while (at < bytes.length) {
		if (bytes[at] !== 0xff) throw new MetadataStripError('Damaged JPEG: expected a marker.');
		// Any number of 0xFF fill bytes may come before a marker.
		while (at + 1 < bytes.length && bytes[at + 1] === 0xff) at++;
		if (at + 1 >= bytes.length) break;
		const marker = bytes[at + 1];

		if (marker === EOI) {
			out.push(bytes.subarray(at, at + 2));
			return Buffer.concat(out);
		}
		// Markers that stand alone, without a length: TEM and the restart markers.
		if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
			out.push(bytes.subarray(at, at + 2));
			at += 2;
			continue;
		}
		if (at + 4 > bytes.length) throw new MetadataStripError('Damaged JPEG: cut off in a header.');
		const end = at + 2 + bytes.readUInt16BE(at + 2);
		if (end > bytes.length)
			throw new MetadataStripError('Damaged JPEG: a segment runs past the end.');

		const kept = keptJpegSegment(marker, bytes.subarray(at, end));
		if (kept) out.push(kept);
		at = end;

		if (marker === SOS) {
			// The compressed scan follows its header, up to the next marker. Inside
			// it a 0xFF is followed by 0x00 (a literal 0xFF) or a restart marker.
			const start = at;
			while (at + 1 < bytes.length) {
				if (bytes[at] === 0xff) {
					const next = bytes[at + 1];
					if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
						at += 2;
						continue;
					}
					if (next !== 0xff) break;
				}
				at++;
			}
			if (at + 1 >= bytes.length) at = bytes.length;
			out.push(bytes.subarray(start, at));
		}
	}

	// No end marker: a truncated file, which decoders show as far as it goes.
	// What was read is kept as it was.
	return Buffer.concat(out);
}

// --- PNG --------------------------------------------------------------------

/**
 * Ancillary chunks that change what the picture looks like. Critical chunks
 * (an upper-case first letter) are always kept, since a decoder must refuse a
 * file without them.
 */
const PNG_KEEP = new Set([
	'tRNS',
	'gAMA',
	'cHRM',
	'sRGB',
	'iCCP',
	'cICP',
	'mDCV',
	'mDCv',
	'cLLI',
	'cLLi',
	'sBIT',
	'bKGD',
	'pHYs',
	'acTL',
	'fcTL',
	'fdAT'
]);

function stripPng(bytes: Buffer): Buffer {
	if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new MetadataStripError('Not a PNG.');
	const out: Buffer[] = [bytes.subarray(0, 8)];
	let at = 8;
	while (at + 12 <= bytes.length) {
		const length = bytes.readUInt32BE(at);
		const type = bytes.toString('latin1', at + 4, at + 8);
		const end = at + 12 + length;
		if (end > bytes.length) throw new MetadataStripError('Damaged PNG: a chunk runs past the end.');
		const critical = (bytes[at + 4] & 0x20) === 0;
		if (critical || PNG_KEEP.has(type)) out.push(bytes.subarray(at, end));
		at = end;
		if (type === 'IEND') break; // and nothing after it
	}
	return Buffer.concat(out);
}

// --- WebP -------------------------------------------------------------------

const WEBP_KEEP = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP']);

/** The `VP8X` flags for EXIF (0x08) and XMP (0x04). */
const VP8X_METADATA_FLAGS = 0x08 | 0x04;

function stripWebp(bytes: Buffer): Buffer {
	if (
		bytes.length < 12 ||
		bytes.toString('latin1', 0, 4) !== 'RIFF' ||
		bytes.toString('latin1', 8, 12) !== 'WEBP'
	) {
		throw new MetadataStripError('Not a WebP.');
	}
	const end = Math.min(bytes.length, 8 + bytes.readUInt32LE(4));
	const chunks: Buffer[] = [];
	let at = 12;
	while (at + 8 <= end) {
		const fourcc = bytes.toString('latin1', at, at + 4);
		const size = bytes.readUInt32LE(at + 4);
		if (at + 8 + size > end)
			throw new MetadataStripError('Damaged WebP: a chunk runs past the end.');
		const chunkEnd = Math.min(end, at + 8 + size + (size & 1));
		if (WEBP_KEEP.has(fourcc)) {
			let chunk = bytes.subarray(at, chunkEnd);
			if (fourcc === 'VP8X' && size >= 1) {
				chunk = Buffer.from(chunk);
				chunk[8] &= ~VP8X_METADATA_FLAGS;
			}
			// A chunk at the very end may lack its padding byte; put it back.
			if (chunk.length % 2 === 1) chunk = Buffer.concat([chunk, Buffer.alloc(1)]);
			chunks.push(chunk);
		}
		at = chunkEnd;
	}
	const body = Buffer.concat(chunks);
	const header = Buffer.alloc(12);
	header.write('RIFF', 0, 'latin1');
	header.writeUInt32LE(body.length + 4, 4);
	header.write('WEBP', 8, 'latin1');
	return Buffer.concat([header, body]);
}

// --- GIF --------------------------------------------------------------------

/** Application blocks that say how an animation plays, which is all a GIF needs. */
const GIF_KEEP_APPLICATIONS = ['NETSCAPE2.0', 'ANIMEXTS1.0'];

function stripGif(bytes: Buffer): Buffer {
	const signature = bytes.toString('latin1', 0, 6);
	if (signature !== 'GIF87a' && signature !== 'GIF89a') throw new MetadataStripError('Not a GIF.');
	if (bytes.length < 13) throw new MetadataStripError('Damaged GIF: cut off in its header.');

	const colourTable = (packed: number) => (packed & 0x80 ? 3 * 2 ** ((packed & 0x07) + 1) : 0);
	const skipSubBlocks = (from: number): number => {
		let p = from;
		while (p < bytes.length && bytes[p] !== 0) p += bytes[p] + 1;
		if (p >= bytes.length) throw new MetadataStripError('Damaged GIF: a block runs past the end.');
		return p + 1;
	};

	let at = 13 + colourTable(bytes[10]);
	const out: Buffer[] = [bytes.subarray(0, at)];
	while (at < bytes.length) {
		const introducer = bytes[at];
		if (introducer === 0x3b) {
			out.push(bytes.subarray(at, at + 1));
			return Buffer.concat(out);
		}
		if (introducer === 0x2c) {
			if (at + 10 > bytes.length) throw new MetadataStripError('Damaged GIF: cut off in a frame.');
			const start = at;
			at += 10 + colourTable(bytes[at + 9]) + 1; // descriptor, local table, LZW code size
			at = skipSubBlocks(at);
			out.push(bytes.subarray(start, at));
			continue;
		}
		if (introducer === 0x21) {
			const label = bytes[at + 1];
			const start = at;
			const end = skipSubBlocks(at + 2);
			if (label === 0xff) {
				const size = bytes[at + 2];
				const app = bytes.toString('latin1', at + 3, at + 3 + Math.min(size, 11));
				if (GIF_KEEP_APPLICATIONS.includes(app)) out.push(bytes.subarray(start, end));
			} else if (label !== 0xfe) {
				// Graphic control (timing, transparency) and plain text are part of the picture.
				out.push(bytes.subarray(start, end));
			}
			at = end;
			continue;
		}
		throw new MetadataStripError('Damaged GIF: unknown block.');
	}
	// No trailer: keep what there is, as a decoder would show it.
	return Buffer.concat(out);
}

// --- SVG --------------------------------------------------------------------

function stripSvg(text: string): string {
	return text.replace(/<!--[\s\S]*?-->/g, '').replace(/<metadata\b[\s\S]*?<\/metadata\s*>/gi, '');
}
