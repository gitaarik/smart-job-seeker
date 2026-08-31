/**
 * Document extraction orchestrator.
 *
 * Turns one uploaded file (a loose doc or a ZIP) into the extracted text we
 * persist, applying every safety layer in order: magic-byte sniff → sandboxed
 * unzip (for archives) → text extraction → secret redaction. The raw upload is
 * never retained; callers store only what this returns.
 *
 * A pasted note (`extractNote`) lives here too. It has no bytes to sniff and no
 * archive to unpack, but it must not skip redaction, so it shares the same
 * finalize step rather than reimplementing it a module away.
 *
 * See planning/DOCUMENT-INGESTION.md.
 */

import { Buffer } from 'node:buffer';
import {
	DEFAULT_EXTRACT_EXTENSIONS,
	DEFAULT_IGNORE_GLOBS,
	safeUnzip,
	SafeUnzipError,
	type SafeUnzipLimits
} from './safe-unzip';
import { extractTextFromFile } from '../resume/text-extractor';
import { parseEmailToText } from './extract-email';
import { redactSecrets } from './scan-secrets';
import { extOf, MEDIA_EXTENSIONS, sniffUploadKind } from './sniff';

export interface ExtractedFile {
	/** Basename for a loose file; sanitized archive-relative path for members. */
	path: string;
	ext: string;
	text: string;
	chars: number;
	secretsRedacted: number;
}

export interface ExtractedProject {
	kind: 'archive' | 'file';
	files: ExtractedFile[];
	skipped: { path: string; reason: string }[];
	truncated: boolean;
	totalChars: number;
	/** Total UTF-8 bytes of extracted text — the storage-quota unit. */
	totalBytes: number;
	/** Total secrets redacted across all files. */
	secretsRedacted: number;
}

/** Thrown when an upload can't be extracted (unsupported / empty / bad zip). */
export class DocumentExtractError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DocumentExtractError';
	}
}

export const DEFAULT_EXTRACT_LIMITS: SafeUnzipLimits = {
	maxEntries: 5000,
	maxTotalUncompressed: 500 * 1024 * 1024,
	maxFileUncompressed: 25 * 1024 * 1024,
	maxDepth: 32,
	extractExtensions: DEFAULT_EXTRACT_EXTENSIONS,
	ignoreGlobs: DEFAULT_IGNORE_GLOBS
};

const RICH_DOC_MIME: Record<string, string> = {
	pdf: 'application/pdf',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	html: 'text/html',
	htm: 'text/html'
};

function decodeText(bytes: Uint8Array): string {
	// Non-fatal so a stray invalid byte doesn't abort a whole source file.
	return (
		new TextDecoder('utf-8', { fatal: false })
			.decode(bytes)
			// Strip NULs defensively (sniff should have rejected true binaries).
			// eslint-disable-next-line no-control-regex -- matching the control char is the point
			.replace(/\u0000/g, '')
	);
}

function finalize(raw: string): { text: string; secretsRedacted: number } {
	const { text, count } = redactSecrets(raw);
	return { text: text.trim(), secretsRedacted: count };
}

function basename(name: string): string {
	return name.split(/[\\/]/).pop() ?? name;
}

/**
 * Extract text from an uploaded file. Loose PDFs/DOCX/HTML go through the shared
 * text-extractor; source/text files are decoded directly; ZIPs are unpacked
 * under strict limits (junk ignored, per-file/total caps, no traversal).
 */
export async function extractUpload(
	input: { filename: string; bytes: Uint8Array },
	limits: SafeUnzipLimits = DEFAULT_EXTRACT_LIMITS
): Promise<ExtractedProject> {
	const kind = sniffUploadKind(input.bytes, input.filename);
	if (kind === 'media') {
		// Images are kept rather than read (see `media.ts`), and storing them means
		// holding on to bytes this function does not return. A caller that wants
		// them has to take that branch before calling; one that does not gets a
		// refusal it can show, the same as any other file it cannot read.
		throw new DocumentExtractError('Images are stored as attachments, not read as text.');
	}
	if (kind === 'unknown') {
		// Names what IS accepted: the refusal is shown next to the filename that
		// caused it, so repeating the name here says it twice. The image list is
		// read from the classifier rather than written out again, so the sentence
		// cannot promise a format the sniffer refuses.
		throw new DocumentExtractError(
			'Not a file we can read. Add source code, text or docs (PDF, DOCX, HTML, Markdown), ' +
				`a ZIP of those, or an image (${MEDIA_EXTENSIONS.map((e) => `.${e}`).join(', ')}).`
		);
	}
	if (kind === 'zip') return extractArchive(input.bytes, limits);
	return extractLooseFile(input.filename, input.bytes);
}

/** Cap on one pasted note. Longer than this is a document, and documents upload. */
export const MAX_NOTE_CHARS = 100_000;

/**
 * What to call a note.
 *
 * Every label in the app reads `title || original_filename || fallback`, and a
 * note has no filename — so an untitled one is cited as "Untitled" in the very
 * places the citation matters. The first line is what the applicant would have
 * called it anyway, so it stands in when they don't type a title.
 */
export function deriveNoteTitle(given: string | null | undefined, text: string): string {
	const explicit = given?.trim();
	if (explicit) return explicit.slice(0, 255);
	const firstLine = text
		.split('\n')
		.map((l) => l.trim())
		// A markdown heading's hashes are punctuation, not part of the name.
		.map((l) => l.replace(/^#+\s*/, '').trim())
		.find(Boolean);
	if (!firstLine) return 'Note';
	return firstLine.length > 80 ? `${firstLine.slice(0, 79)}\u2026` : firstLine;
}

/**
 * The note's stored path: its title as a filename, under `notes/`.
 *
 * The prefix is not decoration. `buildDocumentBlob` heads each file with
 * `=== path ===`, and that header is all the model has to tell one source from
 * another — without it a note the applicant typed is indistinguishable from a
 * README someone else wrote, and the prompt cannot say which to believe.
 */
function notePath(title: string): string {
	return `notes/${slugForPath(title, 'note')}.md`;
}

/** A title as a filename stem: lowercase, dashes, at most 60 characters. */
export function slugForPath(title: string, fallback: string): string {
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60)
		.replace(/-+$/, '');
	return slug || fallback;
}

/**
 * Text that is already text, as an extracted project — one file, at the path
 * the caller chose.
 *
 * Nothing to sniff and nothing to unpack, but redaction is not skipped: the
 * callers are a paste and an application entry, and both are likelier than a
 * published tree to carry a token.
 */
export function extractText(input: { path: string; ext: string; text: string }): ExtractedProject {
	// eslint-disable-next-line no-control-regex -- matching the control char is the point
	const raw = input.text.replace(/\u0000/g, '').trim();
	if (!raw) throw new DocumentExtractError('The text is empty.');

	const { text, secretsRedacted } = finalize(raw);
	const file: ExtractedFile = {
		path: input.path,
		ext: input.ext,
		text,
		chars: text.length,
		secretsRedacted
	};
	return {
		// The extractor classifies what it produced — one text file. That a human
		// typed it rather than uploaded it is provenance, and rides on the row's
		// `kind`/`source`, exactly as a GitHub zipball's does.
		kind: 'file',
		files: [file],
		skipped: [],
		truncated: false,
		totalChars: file.chars,
		totalBytes: Buffer.byteLength(text, 'utf8'),
		secretsRedacted
	};
}

/**
 * A pasted note as an extracted project.
 *
 * The stored path ends in `.md`, which puts the note ahead of source files in
 * `buildDocumentBlob`'s ordering. That is the right way round — a sentence the
 * applicant wrote about their own work outranks anything inferred from code.
 */
export function extractNote(input: { title: string; text: string }): ExtractedProject {
	// eslint-disable-next-line no-control-regex -- matching the control char is the point
	const raw = input.text.replace(/\u0000/g, '').trim();
	if (!raw) throw new DocumentExtractError('The note is empty.');
	if (raw.length > MAX_NOTE_CHARS) {
		throw new DocumentExtractError(
			`A note is limited to ${MAX_NOTE_CHARS.toLocaleString('en-US')} characters; ` +
				`this one is ${raw.length.toLocaleString('en-US')}. Upload it as a file instead.`
		);
	}
	return extractText({ path: notePath(input.title), ext: 'md', text: raw });
}

async function extractLooseFile(filename: string, bytes: Uint8Array): Promise<ExtractedProject> {
	const ext = extOf(filename);
	let raw: string;
	if (ext === 'eml') {
		try {
			raw = await parseEmailToText(bytes);
		} catch (err) {
			throw new DocumentExtractError((err as Error).message);
		}
	} else if (RICH_DOC_MIME[ext]) {
		try {
			raw = await extractTextFromFile(Buffer.from(bytes), RICH_DOC_MIME[ext]);
		} catch (err) {
			throw new DocumentExtractError((err as Error).message);
		}
	} else {
		raw = decodeText(bytes);
	}

	const { text, secretsRedacted } = finalize(raw);
	if (!text) {
		throw new DocumentExtractError('No text could be extracted from it.');
	}

	const file: ExtractedFile = {
		path: basename(filename),
		ext,
		text,
		chars: text.length,
		secretsRedacted
	};
	return {
		kind: 'file',
		files: [file],
		skipped: [],
		truncated: false,
		totalChars: file.chars,
		totalBytes: Buffer.byteLength(text, 'utf8'),
		secretsRedacted
	};
}

async function extractArchive(
	bytes: Uint8Array,
	limits: SafeUnzipLimits
): Promise<ExtractedProject> {
	let result;
	try {
		result = await safeUnzip(bytes, limits);
	} catch (err) {
		if (err instanceof SafeUnzipError) {
			throw new DocumentExtractError(err.message);
		}
		throw err;
	}

	const files: ExtractedFile[] = [];
	let totalChars = 0;
	let totalBytes = 0;
	let secretsRedacted = 0;

	for (const entry of result.entries) {
		const { text, secretsRedacted: redacted } = finalize(decodeText(entry.bytes));
		if (!text) continue; // empty source file — nothing to store
		files.push({
			path: entry.path,
			ext: entry.ext,
			text,
			chars: text.length,
			secretsRedacted: redacted
		});
		totalChars += text.length;
		totalBytes += Buffer.byteLength(text, 'utf8');
		secretsRedacted += redacted;
	}

	if (files.length === 0) {
		throw new DocumentExtractError('The archive contained no extractable source or text files.');
	}

	return {
		kind: 'archive',
		files,
		skipped: result.skipped,
		truncated: result.truncated,
		totalChars,
		totalBytes,
		secretsRedacted
	};
}
