/**
 * Persistence for document projects.
 *
 * Writes one `profile_document_projects` row (the upload/archive unit) plus a
 * `profile_document_files` row per extracted source file. For everything that
 * is read, the raw upload is not stored — only extracted text — and the
 * per-project `summary` is filled later by the summarizer step.
 *
 * `saveMediaProject` is the other half: an image is kept and not read, so it
 * writes the same row pointing at a stored blob, with no text rows under it.
 */

import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { profile_document_files, profile_document_projects } from '$lib/server/db/schema';
import type { ExtractedProject } from './extract';

export interface SaveDocumentProjectInput {
	profileId: number;
	/**
	 * The file this came from, or null when nothing was uploaded.
	 *
	 * A pasted note has no filename, and inventing one would be a lie that shows:
	 * `original_filename` is the fallback label everywhere a document is cited,
	 * and it is also what a profile export writes out as the source's name.
	 */
	filename: string | null;
	title?: string | null;
	workExperienceId?: number | null;
	workExperienceProjectId?: number | null;
	sideProjectId?: number | null;
	/**
	 * Override the extractor's own classification and provenance.
	 *
	 * A GitHub zipball is indistinguishable from any other ZIP to the extractor,
	 * but everything downstream — the UI label, the re-scan check, the citation
	 * in a cover letter — needs to know it was a repository at a given commit.
	 * Left unset, the extractor's `kind` and a filename-only source are used, as
	 * they are for a plain upload.
	 */
	kind?: string;
	source?: Record<string, unknown>;
}

/**
 * Status of a stored image.
 *
 * Not "extracted": nothing was. The extraction statuses are claims about text
 * that was read out of a file, and an image has none to read — so it gets a
 * word of its own rather than borrowing one that would be false. A vision pass
 * would fill `summary` without changing this.
 */
export const MEDIA_STATUS = 'stored';

export interface SaveMediaProjectInput {
	profileId: number;
	/** `files.id` of the normalized image this row is a record of. */
	fileId: string;
	/** The name it was uploaded under. */
	filename: string;
	title?: string | null;
	workExperienceId?: number | null;
	workExperienceProjectId?: number | null;
	sideProjectId?: number | null;
	source?: Record<string, unknown>;
}

export interface SavedDocumentProject {
	id: number;
	status: string;
	kind: string;
	title: string;
	fileCount: number;
	totalChars: number;
	totalBytes: number;
	truncated: boolean;
	skippedCount: number;
	secretsRedacted: number;
}

export async function saveExtractedProject(
	input: SaveDocumentProjectInput,
	extracted: ExtractedProject
): Promise<SavedDocumentProject> {
	const now = new Date();
	const status = extracted.truncated ? 'partial' : 'extracted';
	const title = input.title?.trim() || input.filename || 'Untitled';

	const [project] = await db
		.insert(profile_document_projects)
		.values({
			profile_id: input.profileId,
			work_experience_id: input.workExperienceId ?? null,
			work_experience_project_id: input.workExperienceProjectId ?? null,
			side_project_id: input.sideProjectId ?? null,
			kind: input.kind ?? extracted.kind,
			title,
			original_filename: input.filename,
			// Provider-agnostic provenance; git sources pass a richer object in.
			source: input.source ?? { type: extracted.kind, filename: input.filename },
			status,
			skipped: extracted.skipped.length > 0 ? extracted.skipped : null,
			file_count: extracted.files.length,
			total_chars: extracted.totalChars,
			total_bytes: extracted.totalBytes,
			date_created: now,
			date_updated: now
		})
		.returning({ id: profile_document_projects.id });

	if (extracted.files.length > 0) {
		await db.insert(profile_document_files).values(
			extracted.files.map((f, i) => ({
				project_id: project.id,
				path: f.path,
				ext: f.ext,
				extracted_text: f.text,
				chars: f.chars,
				sort: i,
				date_created: now
			}))
		);
	}

	return {
		id: project.id,
		status,
		kind: input.kind ?? extracted.kind,
		title,
		fileCount: extracted.files.length,
		totalChars: extracted.totalChars,
		totalBytes: extracted.totalBytes,
		truncated: extracted.truncated,
		skippedCount: extracted.skipped.length,
		secretsRedacted: extracted.secretsRedacted
	};
}

/**
 * An image, kept as an image.
 *
 * Its own function rather than an `ExtractedProject` with an empty `files`
 * array, because the two differ in every field that matters: there is a blob
 * to point at, there is no text, and `status` is not a claim about extraction.
 * Squeezing it through `saveExtractedProject` would mean a function called
 * "extracted" writing rows where nothing was.
 *
 * `total_bytes` stays 0. It is the extracted-text quota unit, and the stored
 * image's size lives on the `files` row — mixing disk bytes into a text budget
 * would make one column mean two things and every sum over it wrong.
 */
export async function saveMediaProject(
	input: SaveMediaProjectInput
): Promise<SavedDocumentProject> {
	const now = new Date();
	const title = input.title?.trim() || input.filename || 'Untitled';

	const [project] = await db
		.insert(profile_document_projects)
		.values({
			profile_id: input.profileId,
			work_experience_id: input.workExperienceId ?? null,
			work_experience_project_id: input.workExperienceProjectId ?? null,
			side_project_id: input.sideProjectId ?? null,
			file_id: input.fileId,
			kind: 'media',
			title,
			// The name it was uploaded under, not the `.webp` it was re-encoded to:
			// this is the label, and the user is looking for the file they sent.
			original_filename: input.filename,
			source: input.source ?? { type: 'media', filename: input.filename },
			status: MEDIA_STATUS,
			file_count: 1,
			total_chars: 0,
			total_bytes: 0,
			date_created: now,
			date_updated: now
		})
		.returning({ id: profile_document_projects.id });

	return {
		id: project.id,
		status: MEDIA_STATUS,
		kind: 'media',
		title,
		fileCount: 1,
		totalChars: 0,
		totalBytes: 0,
		truncated: false,
		skippedCount: 0,
		secretsRedacted: 0
	};
}

/** Attach the summarizer's output to a project row. */
export async function setProjectSummary(
	projectId: number,
	summary: string,
	keywords: string[]
): Promise<void> {
	await db
		.update(profile_document_projects)
		.set({
			summary: summary.trim() || null,
			keywords: keywords.length > 0 ? keywords : null,
			date_updated: new Date()
		})
		.where(eq(profile_document_projects.id, projectId));
}

/**
 * Swap a note's text for a new version, in place.
 *
 * A note is the one attachment kind whose content exists nowhere else: an
 * upload can be re-uploaded and a repository re-scanned, but a paste the
 * applicant typed is gone if this loses it. So the rows move inside a
 * transaction — delete-then-insert without one leaves a window where the note
 * is a row with no text, and a crash in that window is silent data loss.
 *
 * The embedding cache needs no invalidation: it is hash-gated, so the next
 * retrieval sees changed text and re-embeds on its own.
 */
export async function replaceNoteContent(
	projectId: number,
	title: string,
	extracted: ExtractedProject
): Promise<void> {
	const now = new Date();
	await db.transaction(async (tx) => {
		await tx.delete(profile_document_files).where(eq(profile_document_files.project_id, projectId));
		await tx.insert(profile_document_files).values(
			extracted.files.map((f, i) => ({
				project_id: projectId,
				path: f.path,
				ext: f.ext,
				extracted_text: f.text,
				chars: f.chars,
				sort: i,
				date_created: now
			}))
		);
		await tx
			.update(profile_document_projects)
			.set({
				title,
				file_count: extracted.files.length,
				total_chars: extracted.totalChars,
				total_bytes: extracted.totalBytes,
				status: 'extracted',
				date_updated: now
			})
			.where(eq(profile_document_projects.id, projectId));
	});
}
