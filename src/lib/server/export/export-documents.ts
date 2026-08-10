/**
 * Export uploaded project documents (the document-ingestion units).
 *
 * Extracted text goes into the archive as real files under
 * `documents/<nn>-<slug>/`, and only the metadata manifest goes into
 * `data.json`. Inlining the text is not an option: `DEFAULT_EXTRACT_LIMITS`
 * allows 500 MB of extracted text per archive, which would produce a data.json
 * nothing can open and the importer can't stream.
 *
 * Documents attach to a work-experience project, a side project, or a work
 * experience. The export carries no database ids, so the parent is referenced
 * by its position in the exported arrays — the importer recreates entities in
 * that same order, which makes the index a stable join key.
 */

import { dbDirect } from '$lib/server/db';
import { asc, eq } from 'drizzle-orm';
import { profile_document_files, profile_document_projects } from '$lib/server/db/schema';
import type { DocumentFilePayload, ExportedDocument, ExportedDocumentFile } from './types';

/**
 * Position of each project entity within the exported arrays, keyed by its
 * database id. Built by the profile export, which owns the ordering.
 */
export interface ProjectIndexMaps {
	workExperienceIndexById: Map<number, number>;
	workExperienceProjectIndexById: Map<
		number,
		{ work_experience_index: number; project_index: number }
	>;
	sideProjectIndexById: Map<number, number>;
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
		.slice(0, 60);
}

/**
 * Directory an attachment's files live under inside the archive. The numeric
 * prefix is what makes it unique — two uploads can share a title.
 */
export function documentArchiveDir(index: number, label: string | null | undefined): string {
	const slug = slugify(label ?? '') || 'document';
	return `documents/${String(index + 1).padStart(2, '0')}-${slug}`;
}

/**
 * Make a stored source path safe to use as a ZIP entry.
 *
 * Paths are already sanitized by `safeUnzip` on the way in, so this guards the
 * read side: an export ZIP is user-supplied on import, and its manifest must
 * not be able to point at a parent directory.
 */
export function sanitizeArchivePath(raw: string | null | undefined, fallbackIndex: number): string {
	const cleaned = (raw ?? '')
		.replace(/\\/g, '/')
		.split('/')
		.map((segment) => segment.trim())
		.filter((segment) => segment && segment !== '.' && segment !== '..')
		.join('/');
	return cleaned || `file-${fallbackIndex + 1}.txt`;
}

function resolveAttachment(
	doc: {
		work_experience_id: number | null;
		work_experience_project_id: number | null;
		side_project_id: number | null;
	},
	maps: ProjectIndexMaps
): ExportedDocument['attached_to'] {
	if (doc.work_experience_project_id !== null) {
		const position = maps.workExperienceProjectIndexById.get(doc.work_experience_project_id);
		if (position) {
			return { kind: 'work_experience_project', ...position };
		}
	}

	if (doc.side_project_id !== null) {
		const index = maps.sideProjectIndexById.get(doc.side_project_id);
		if (index !== undefined) {
			return { kind: 'side_project', side_project_index: index };
		}
	}

	if (doc.work_experience_id !== null) {
		const index = maps.workExperienceIndexById.get(doc.work_experience_id);
		if (index !== undefined) {
			return { kind: 'work_experience', work_experience_index: index };
		}
	}

	// The row survived its parent (work_experience_id is ON DELETE SET NULL), or
	// predates the UI always attaching. Still the user's data — export it loose
	// rather than dropping it.
	return { kind: 'unattached' };
}

/**
 * Build the document manifest plus the file payloads the ZIP writer needs.
 */
export async function buildDocumentExport(
	profileId: number,
	maps: ProjectIndexMaps
): Promise<{ documents: ExportedDocument[]; documentFiles: DocumentFilePayload[] }> {
	const rows = await dbDirect.query.profile_document_projects.findMany({
		where: eq(profile_document_projects.profile_id, profileId),
		with: {
			profile_document_files: {
				columns: {
					path: true,
					ext: true,
					extracted_text: true,
					chars: true,
					sort: true
				},
				orderBy: asc(profile_document_files.sort)
			}
		},
		orderBy: [asc(profile_document_projects.sort), asc(profile_document_projects.id)]
	});

	const documents: ExportedDocument[] = [];
	const documentFiles: DocumentFilePayload[] = [];

	rows.forEach((doc, docIndex) => {
		const archiveDir = documentArchiveDir(docIndex, doc.title || doc.original_filename);

		const files: ExportedDocumentFile[] = doc.profile_document_files.map((file, fileIndex) => {
			const path = sanitizeArchivePath(file.path, fileIndex);
			const archivePath = `${archiveDir}/${path}`;

			documentFiles.push({ archivePath, text: file.extracted_text ?? '' });

			return {
				path,
				archivePath,
				ext: file.ext || undefined,
				chars: file.chars,
				sort: file.sort
			};
		});

		documents.push({
			archive_dir: archiveDir,
			attached_to: resolveAttachment(doc, maps),
			kind: doc.kind,
			title: doc.title || undefined,
			original_filename: doc.original_filename || undefined,
			source: doc.source ?? undefined,
			summary: doc.summary || undefined,
			keywords: doc.keywords ?? undefined,
			status: doc.status,
			skipped: doc.skipped ?? undefined,
			file_count: doc.file_count,
			total_chars: doc.total_chars,
			total_bytes: doc.total_bytes,
			sort: doc.sort,
			files
		});
	});

	return { documents, documentFiles };
}
