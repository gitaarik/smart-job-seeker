/**
 * One profile document.
 *
 *   GET    /api/profile/[id]/documents/[docId]  — read a note's text (notes only)
 *   PATCH  /api/profile/[id]/documents/[docId]  — rewrite a note (notes only)
 *   DELETE /api/profile/[id]/documents/[docId]  — remove it and its extracted files
 *
 * GET and PATCH are note-only on purpose. Every other kind is a *record of
 * something that exists elsewhere* — an upload can be uploaded again, a
 * repository re-scanned at its current commit — and editing the extracted text
 * would quietly make the copy disagree with the original it is named after. A
 * note has no original, so it is the one kind where "fix the typo" has to mean
 * editing what is stored.
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, asc, eq } from 'drizzle-orm';
import { profile_document_files, profile_document_projects } from '$lib/server/db/schema';
import { parseIntParam, requireAuth, requireProfileAccess } from '$lib/server/utils/api-helpers';
import { requireCredits } from '$lib/server/billing/require-credits';
import { requireDocumentQuota } from '$lib/server/billing/require-document-quota';
import { deriveNoteTitle, DocumentExtractError, extractNote } from '$lib/server/documents/extract';
import { replaceNoteContent, setProjectSummary } from '$lib/server/documents/store';
import { summarizeProject } from '$lib/server/documents/summarize';

/** The note, or a 404/400 — scoped to the profile so nobody reads another's. */
async function requireNote(docId: number, profileId: number) {
	const row = await db.query.profile_document_projects.findFirst({
		where: and(
			eq(profile_document_projects.id, docId),
			eq(profile_document_projects.profile_id, profileId)
		),
		columns: { id: true, kind: true, title: true, total_bytes: true },
		with: {
			profile_document_files: {
				orderBy: asc(profile_document_files.sort),
				columns: { extracted_text: true }
			}
		}
	});
	if (!row) error(404, 'Document not found');
	if (row.kind !== 'note') error(400, 'Only notes can be edited.');
	return row;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	const profileId = parseIntParam(params.id, 'profile');
	const docId = parseIntParam(params.docId, 'document');
	await requireProfileAccess(profileId, user.id);

	const note = await requireNote(docId, profileId);
	return json({
		id: note.id,
		title: note.title,
		text: note.profile_document_files.map((f) => f.extracted_text ?? '').join('\n')
	});
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const profileId = parseIntParam(params.id, 'profile');
	const docId = parseIntParam(params.docId, 'document');
	await requireProfileAccess(profileId, user.id);

	const note = await requireNote(docId, profileId);
	const body = await request.json().catch(() => null);
	const text = typeof body?.text === 'string' ? body.text : '';
	const givenTitle = typeof body?.title === 'string' ? body.title : null;

	let extracted;
	const title = deriveNoteTitle(givenTitle, text);
	try {
		extracted = extractNote({ title, text });
	} catch (err) {
		if (err instanceof DocumentExtractError) error(400, err.message);
		throw err;
	}

	// Only growth is chargeable against the quota; a shorter note frees space.
	await requireDocumentQuota(user.id, Math.max(0, extracted.totalBytes - note.total_bytes), 0);
	// Affordability floor; the per-token charge happens inside summarizeProject.
	await requireCredits(user.id, 3);

	await replaceNoteContent(docId, title, extracted);

	// Re-summarize, best-effort — the edit is saved either way, and stale
	// reference notes are visibly stale next to text that no longer says that.
	let summary: string | null = null;
	let keywords: string[] = [];
	const result = await summarizeProject(profileId, extracted.files).catch(() => null);
	if (result) {
		await setProjectSummary(docId, result.summary, result.keywords);
		summary = result.summary || null;
		keywords = result.keywords;
	}

	return json({ success: true, id: docId, title, summary, keywords });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	const profileId = parseIntParam(params.id, 'profile');
	const docId = parseIntParam(params.docId, 'document');
	await requireProfileAccess(profileId, user.id);

	const [deleted] = await db
		.delete(profile_document_projects)
		.where(
			and(
				eq(profile_document_projects.id, docId),
				eq(profile_document_projects.profile_id, profileId)
			)
		)
		.returning({ id: profile_document_projects.id });

	if (!deleted) error(404, 'Document not found');
	return json({ success: true });
};
