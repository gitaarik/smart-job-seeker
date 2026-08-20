/**
 * Reading a profile's ingested documents whole, for a caller that is not a
 * prompt.
 *
 * The chat never needs this. Its access to documents is `retrieval.ts` — top-k
 * passages ranked against what the user is asking about — because a prompt has
 * a budget and a document store does not fit in one. An MCP client has the
 * opposite shape: it assembles its own context and pulls what it wants, so the
 * honest interface there is a list and a reader rather than a ranking.
 *
 * Two tables, and the split matters. `profile_document_projects` is the unit a
 * person uploaded — a file, an archive, a repo scan, a typed note — and
 * `profile_document_files` is what came out of it, one row per extracted file.
 * A one-file upload is a project with one file; a repository is a project with
 * hundreds. So a "document" is addressed by project, and its text is the files
 * in `sort` order.
 */

import { db } from '$lib/server/db';
import { and, asc, eq } from 'drizzle-orm';
import { profile_document_files, profile_document_projects } from '$lib/server/db/schema';

export const DOCUMENT_PAGE_DEFAULT = 20;
export const DOCUMENT_PAGE_MAX = 50;

/**
 * How much text one read returns before it asks the caller to come back with an
 * offset.
 *
 * Same ceiling the chat's activity source uses for one entry, and chosen the
 * same way: a backstop against a 2MB archive rather than a budget. A repository
 * scan is routinely past it, which is exactly why the offset exists.
 */
export const DOCUMENT_READ_CHARS = 60000;

export interface ProfileDocumentSummary {
	id: number;
	kind: string;
	/** Nullable in the table: a pasted note may never have been given one. */
	title: string | null;
	filename: string | null;
	status: string;
	summary: string | null;
	file_count: number;
	total_chars: number;
}

export interface ProfileDocumentText extends ProfileDocumentSummary {
	/** The slice returned, and where it sat, so a caller can ask for the rest. */
	text: string;
	offset: number;
	returned_chars: number;
	more: boolean;
	files: { path: string | null; chars: number }[];
}

export async function listProfileDocuments(
	profileId: number,
	opts: { limit?: number } = {}
): Promise<ProfileDocumentSummary[]> {
	const limit = Math.min(Math.max(opts.limit ?? DOCUMENT_PAGE_DEFAULT, 1), DOCUMENT_PAGE_MAX);

	const rows = await db.query.profile_document_projects.findMany({
		where: eq(profile_document_projects.profile_id, profileId),
		columns: {
			id: true,
			kind: true,
			title: true,
			original_filename: true,
			status: true,
			summary: true,
			file_count: true,
			total_chars: true
		},
		orderBy: [asc(profile_document_projects.sort), asc(profile_document_projects.id)],
		limit
	});

	return rows.map((row) => ({
		id: row.id,
		kind: row.kind,
		title: row.title,
		filename: row.original_filename,
		status: row.status,
		summary: row.summary,
		file_count: row.file_count ?? 0,
		total_chars: row.total_chars ?? 0
	}));
}

/**
 * One document's extracted text, or null when it is not this profile's.
 *
 * Scoped in the same query that finds it, so an id belonging to someone else is
 * indistinguishable from one that does not exist.
 */
export async function readProfileDocument(
	documentId: number,
	profileId: number,
	opts: { offset?: number } = {}
): Promise<ProfileDocumentText | null> {
	const row = await db.query.profile_document_projects.findFirst({
		where: and(
			eq(profile_document_projects.id, documentId),
			eq(profile_document_projects.profile_id, profileId)
		),
		columns: {
			id: true,
			kind: true,
			title: true,
			original_filename: true,
			status: true,
			summary: true,
			file_count: true,
			total_chars: true
		}
	});
	if (!row) return null;

	const files = await db.query.profile_document_files.findMany({
		where: eq(profile_document_files.project_id, documentId),
		columns: { path: true, extracted_text: true, chars: true },
		orderBy: [asc(profile_document_files.sort), asc(profile_document_files.id)]
	});

	// One text, with each file announced. A repo scan's value is largely in which
	// file a passage came from, and concatenating without saying so throws that
	// away — the same reason the activity formatter heads each entry.
	const whole = files
		.map((file) => `--- ${file.path ?? '(file)'} ---\n${file.extracted_text ?? ''}`)
		.join('\n\n');

	const offset = Math.max(opts.offset ?? 0, 0);
	const text = whole.slice(offset, offset + DOCUMENT_READ_CHARS);

	return {
		id: row.id,
		kind: row.kind,
		title: row.title,
		filename: row.original_filename,
		status: row.status,
		summary: row.summary,
		file_count: row.file_count ?? 0,
		total_chars: row.total_chars ?? 0,
		text,
		offset,
		returned_chars: text.length,
		more: offset + text.length < whole.length,
		files: files.map((file) => ({ path: file.path, chars: file.chars ?? 0 }))
	};
}
