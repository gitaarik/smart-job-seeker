/**
 * Magic-byte sniffing for uploaded documents.
 *
 * Client-declared MIME / extension is untrusted — a renamed `.exe` must never
 * reach a parser. We verify the actual bytes: PDFs must start with `%PDF`,
 * ZIP/DOCX with the PK signature, images with their own signatures, and
 * text/source files must look like text (no NUL bytes). Extension is used only
 * to disambiguate (docx vs zip are both PK) and must agree with the header.
 *
 * "media" is the one kind that is kept rather than read (see `media.ts`). It is
 * classified here with everything else because the question is the same one —
 * what did we actually receive — and answering it in two places is how the two
 * answers start to disagree.
 */

import { DEFAULT_EXTRACT_EXTENSIONS } from './safe-unzip';

export type UploadKind = 'zip' | 'pdf' | 'docx' | 'text' | 'email' | 'media' | 'unknown';

const TEXT_EXTS = new Set(DEFAULT_EXTRACT_EXTENSIONS);

/**
 * Image extensions the media path accepts, without the dot.
 *
 * Lives here rather than in `media.ts` because `media.ts` needs the extract
 * error type and `extract.ts` needs this module — putting the list with its
 * consumer would close that triangle into a cycle. Classification is this
 * module's job anyway.
 */
export const MEDIA_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] as const;

const MEDIA_EXTS: ReadonlySet<string> = new Set(MEDIA_EXTENSIONS);

/** Whether an extension names an image the media path handles. */
export function isMediaExtension(ext: string): boolean {
	return MEDIA_EXTS.has(ext);
}

/** Lowercased extension without the dot; leading-dot files → the name itself. */
export function extOf(filename: string): string {
	const base = filename.split(/[\\/]/).pop() ?? '';
	const dot = base.lastIndexOf('.');
	if (dot < 0) return '';
	if (dot === 0) return base.slice(1).toLowerCase();
	return base.slice(dot + 1).toLowerCase();
}

/** Heuristic: no NUL byte in the leading window → treat as text. */
function looksLikeText(bytes: Uint8Array): boolean {
	const n = Math.min(bytes.length, 8000);
	for (let i = 0; i < n; i++) {
		if (bytes[i] === 0) return false;
	}
	return true;
}

function hasPdfHeader(b: Uint8Array): boolean {
	return b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // %PDF
}

/**
 * PNG, JPEG, GIF or WebP by signature. SVG has none — it is XML — so it is
 * recognized by extension plus looking like text, and rasterized on ingest.
 */
function hasImageHeader(b: Uint8Array): boolean {
	// PNG: 89 50 4E 47 0D 0A 1A 0A
	if (
		b.length >= 8 &&
		b[0] === 0x89 &&
		b[1] === 0x50 &&
		b[2] === 0x4e &&
		b[3] === 0x47 &&
		b[4] === 0x0d &&
		b[5] === 0x0a &&
		b[6] === 0x1a &&
		b[7] === 0x0a
	) {
		return true;
	}
	// JPEG: FF D8 FF
	if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
	// GIF87a / GIF89a
	if (
		b.length >= 6 &&
		b[0] === 0x47 &&
		b[1] === 0x49 &&
		b[2] === 0x46 &&
		b[3] === 0x38 &&
		(b[4] === 0x37 || b[4] === 0x39) &&
		b[5] === 0x61
	) {
		return true;
	}
	// WebP: "RIFF" ???? "WEBP"
	if (
		b.length >= 12 &&
		b[0] === 0x52 &&
		b[1] === 0x49 &&
		b[2] === 0x46 &&
		b[3] === 0x46 &&
		b[8] === 0x57 &&
		b[9] === 0x45 &&
		b[10] === 0x42 &&
		b[11] === 0x50
	) {
		return true;
	}
	return false;
}

function hasZipHeader(b: Uint8Array): boolean {
	return (
		b.length >= 4 &&
		b[0] === 0x50 &&
		b[1] === 0x4b && // PK
		(b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07) &&
		(b[3] === 0x04 || b[3] === 0x06 || b[3] === 0x08)
	);
}

/**
 * Classify an uploaded file by its bytes (with the extension as a tiebreaker).
 * Returns "unknown" when the header contradicts the extension or the type is
 * not something we can extract text from.
 */
export function sniffUploadKind(bytes: Uint8Array, filename: string): UploadKind {
	const ext = extOf(filename);

	if (hasPdfHeader(bytes)) {
		// A real PDF; require the extension to agree (don't parse a `.jpg` as PDF).
		return ext === 'pdf' || ext === '' ? 'pdf' : 'unknown';
	}
	if (hasZipHeader(bytes)) {
		// Both DOCX and ZIP are PK containers; disambiguate by extension.
		return ext === 'docx' ? 'docx' : 'zip';
	}
	if (hasImageHeader(bytes)) {
		// Any image extension will do, not the matching one. What gets stored is
		// re-encoded from whatever sharp decodes, so a `.png` holding a JPEG is
		// harmless — while still refusing the renamed binary this check is for.
		return isMediaExtension(ext) || ext === '' ? 'media' : 'unknown';
	}

	// No binary container signature: an ext claiming one is a mismatch.
	if (ext === 'pdf' || ext === 'docx' || ext === 'zip') return 'unknown';
	// Same for a raster extension with no matching header. SVG is the exception:
	// it is genuinely text, and it is the one image kind sniffed by extension.
	if (isMediaExtension(ext) && ext !== 'svg') return 'unknown';
	if (ext === 'svg' && looksLikeText(bytes)) return 'media';

	// An .eml is RFC822 text; the MIME parser turns it into readable text.
	if (ext === 'eml' && looksLikeText(bytes)) return 'email';
	if (TEXT_EXTS.has(ext) && looksLikeText(bytes)) return 'text';
	return 'unknown';
}
