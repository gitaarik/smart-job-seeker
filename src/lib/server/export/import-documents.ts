/**
 * Restore uploaded project documents from an export.
 *
 * The export references parents by position, so this runs after the profile
 * entities are recreated and joins on the ids they were assigned. A document
 * whose parent index doesn't resolve is still imported, unattached — losing the
 * link is recoverable, losing the text is not.
 *
 * `file_id` is never restored: the original upload is discarded at ingest time
 * (only extracted text is kept), so there is nothing to point at.
 */

import { dbDirect } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { profile_document_files, profile_document_projects } from '$lib/server/db/schema';
import { sanitizeArchivePath } from './export-documents';
import type { ExportedDocument } from './types';

/**
 * Database ids assigned while importing profile entities, keyed by the position
 * the export used.
 */
export interface CreatedProjectIds {
	workExperienceIdByIndex: number[];
	/** Keyed `${workExperienceIndex}:${projectIndex}` */
	workExperienceProjectIdByIndex: Map<string, number>;
	sideProjectIdByIndex: number[];
}

export function emptyCreatedProjectIds(): CreatedProjectIds {
	return {
		workExperienceIdByIndex: [],
		workExperienceProjectIdByIndex: new Map(),
		sideProjectIdByIndex: []
	};
}

interface ParentIds {
	work_experience_id: number | null;
	work_experience_project_id: number | null;
	side_project_id: number | null;
}

/**
 * Turn a document's positional reference back into database ids. Exported for
 * tests: this is the join that decides whether a restored document lands on the
 * right project or loose.
 */
export function resolveParentIds(
	document: ExportedDocument,
	created: CreatedProjectIds
): ParentIds {
	const none: ParentIds = {
		work_experience_id: null,
		work_experience_project_id: null,
		side_project_id: null
	};

	const attachment = document.attached_to;
	if (!attachment) return none;

	switch (attachment.kind) {
		case 'work_experience_project': {
			const key = `${attachment.work_experience_index}:${attachment.project_index}`;
			const projectId = created.workExperienceProjectIdByIndex.get(key);
			if (projectId === undefined) return none;
			// Only the project id — the upload API leaves work_experience_id null for
			// a project attachment, and an imported profile should match a native one.
			return { ...none, work_experience_project_id: projectId };
		}
		case 'side_project': {
			const sideProjectId = created.sideProjectIdByIndex[attachment.side_project_index];
			if (sideProjectId === undefined) return none;
			return { ...none, side_project_id: sideProjectId };
		}
		case 'work_experience': {
			const workId = created.workExperienceIdByIndex[attachment.work_experience_index];
			if (workId === undefined) return none;
			return { ...none, work_experience_id: workId };
		}
		default:
			return none;
	}
}

/**
 * Insert the documents from an export. Returns how many attachments landed.
 */
export async function importDocuments(
	profileId: number,
	documents: ExportedDocument[],
	documentTexts: Map<string, string>,
	created: CreatedProjectIds
): Promise<number> {
	const now = new Date();
	let imported = 0;

	for (const document of documents) {
		const parent = resolveParentIds(document, created);

		const [createdDocument] = await dbDirect
			.insert(profile_document_projects)
			.values({
				profile_id: profileId,
				...parent,
				kind: document.kind || 'file',
				title: document.title || null,
				original_filename: document.original_filename || null,
				source: document.source ?? null,
				summary: document.summary || null,
				keywords: document.keywords ?? null,
				status: document.status || 'extracted',
				skipped: document.skipped ?? null,
				file_count: document.file_count ?? 0,
				total_chars: document.total_chars ?? 0,
				total_bytes: document.total_bytes ?? 0,
				sort: document.sort ?? null,
				date_created: now,
				date_updated: now
			})
			.returning({ id: profile_document_projects.id });

		const files = (document.files ?? []).map((file, index) => ({
			project_id: createdDocument.id,
			path: sanitizeArchivePath(file.path, index),
			ext: file.ext || null,
			extracted_text: documentTexts.get(file.archivePath) ?? null,
			chars: file.chars ?? 0,
			sort: file.sort ?? index,
			date_created: now
		}));

		if (files.length > 0) {
			await dbDirect.insert(profile_document_files).values(files);
		}

		imported++;
	}

	return imported;
}

/**
 * Remove a profile's documents. Attachments hanging off a work experience use
 * ON DELETE SET NULL, so deleting the parent rows alone would leave them
 * behind as unattached duplicates on an overwrite import.
 */
export async function deleteProfileDocuments(profileId: number): Promise<void> {
	const rows = await dbDirect.query.profile_document_projects.findMany({
		where: eq(profile_document_projects.profile_id, profileId),
		columns: { id: true }
	});

	for (const row of rows) {
		await dbDirect
			.delete(profile_document_files)
			.where(eq(profile_document_files.project_id, row.id));
	}

	await dbDirect
		.delete(profile_document_projects)
		.where(eq(profile_document_projects.profile_id, profileId));
}
