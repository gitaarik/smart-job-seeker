/**
 * POST /api/profile/[id]/documents/[docId]/reparse
 *
 * Re-run the LLM summary for a document project from its ALREADY-EXTRACTED text
 * (no re-upload — raw files aren't retained). Useful when the first summary
 * failed or you want to refresh it. Charges credits like the initial summarize.
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, asc, eq } from 'drizzle-orm';
import { profile_document_files, profile_document_projects } from '$lib/server/db/schema';
import { parseIntParam, requireAuth, requireProfileAccess } from '$lib/server/utils/api-helpers';
import { requireCredits } from '$lib/server/billing/require-credits';
import { summarizeProject } from '$lib/server/documents/summarize';
import { setProjectSummary } from '$lib/server/documents/store';

export const POST: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	const profileId = parseIntParam(params.id, 'profile');
	const docId = parseIntParam(params.docId, 'document');
	await requireProfileAccess(profileId, user.id);

	const project = await db.query.profile_document_projects.findFirst({
		where: and(
			eq(profile_document_projects.id, docId),
			eq(profile_document_projects.profile_id, profileId)
		),
		columns: { id: true },
		with: {
			profile_document_files: {
				orderBy: asc(profile_document_files.sort),
				columns: { path: true, extracted_text: true }
			}
		}
	});
	if (!project) error(404, 'Document not found');

	const files = project.profile_document_files
		.filter((f) => (f.extracted_text ?? '').trim().length > 0)
		.map((f) => ({ path: f.path ?? '', text: f.extracted_text ?? '' }));
	if (files.length === 0) {
		error(400, 'This document has no extracted text to summarize.');
	}

	// Affordability floor; the per-token charge happens inside summarizeProject.
	await requireCredits(user.id, 3);

	const result = await summarizeProject(profileId, files);
	if (!result) error(502, 'Summarization failed. Please try again.');

	await setProjectSummary(docId, result.summary, result.keywords);
	return json({
		success: true,
		summary: result.summary || null,
		keywords: result.keywords
	});
};
