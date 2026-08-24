/**
 * Copy an application entry into a project's Files & code.
 *
 *   POST /api/project-sources/[kind]/[id]/from-record   { record_id }
 *
 * The entry's text becomes one more attachment on the project, and from there
 * it reaches everything an upload reaches: the summarizer, the embeddings, the
 * proposals on the Details tab, the citations in letters and answers, and the
 * MCP client's document list. See `documents/from-record.ts` for why this is a
 * copy rather than a link.
 *
 * Costs credits and eats storage quota like an upload, so it uses the upload
 * route's guards in the upload route's order.
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { desc, eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { application_records, profile_document_projects } from '$lib/server/db/schema';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { requireRowActor } from '$lib/server/profile/write-http';
import { requireCredits } from '$lib/server/billing/require-credits';
import { requireDocumentQuota } from '$lib/server/billing/require-document-quota';
import { DocumentExtractError } from '$lib/server/documents/extract';
import { buildRecordDocument } from '$lib/server/documents/from-record';
import { saveExtractedProject, setProjectSummary } from '$lib/server/documents/store';
import { summarizeProject } from '$lib/server/documents/summarize';
import { parseProjectKind, type ProjectKind } from '$lib/server/documents/project-corpus';
import { extractRecordFile } from '$lib/server/ai-chat/application-activity';
import { applicationRecordSource } from '$lib/document-sources';

/** The copy this project already holds of this entry, if any. */
async function existingCopy(kind: ProjectKind, projectId: number, recordId: number) {
	const scoped =
		kind === 'side_project'
			? eq(profile_document_projects.side_project_id, projectId)
			: eq(profile_document_projects.work_experience_project_id, projectId);

	const rows = await db.query.profile_document_projects.findMany({
		where: scoped,
		orderBy: [desc(profile_document_projects.date_created)],
		columns: { id: true, title: true, source: true }
	});
	return rows.find((row) => applicationRecordSource(row.source)?.record_id === recordId) ?? null;
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const kind = parseProjectKind(params.kind);
	if (!kind) error(400, 'Unknown project type');
	const projectId = parseIntParam(params.id, 'project');
	const actor = await requireRowActor(kind, projectId, user.id);

	const body = (await request.json().catch(() => ({}))) as { record_id?: unknown };
	const recordId =
		typeof body.record_id === 'number' && Number.isInteger(body.record_id) && body.record_id > 0
			? body.record_id
			: null;
	if (recordId === null) error(400, 'record_id is required');

	const record = await db.query.application_records.findFirst({
		where: eq(application_records.id, recordId),
		columns: {
			id: true,
			title: true,
			record_type: true,
			content: true,
			event_date: true,
			extraction_status: true
		},
		with: {
			application: {
				columns: { id: true, profile_id: true },
				with: { job: { columns: { title: true, company: true } } }
			},
			file: { columns: { filename_download: true } }
		}
	});
	// A missing entry and someone else's get the same answer: neither is this
	// applicant's to copy, and the project's owner is who is asking.
	if (!record || record.application?.profile_id !== actor.profileId) {
		error(404, 'Entry not found');
	}

	// Copying twice would give the project two identical sources and the model
	// two identical files. Answer with the copy it already has.
	const already = await existingCopy(kind, projectId, recordId);
	if (already) {
		return json({
			success: true,
			unchanged: true,
			document: { id: already.id, title: already.title }
		});
	}

	// An entry whose file has not been read yet is read now, the way the
	// activity page and the assistant read it; a typed entry's text is its text.
	const content =
		record.extraction_status === 'pending'
			? ((await extractRecordFile(record.id)) ?? record.content)
			: record.content;
	if (!content?.trim()) {
		error(400, 'This entry has no text to copy yet — it may still be reading its file.');
	}

	// Affordability floor for the summarization LLM call; the real per-token
	// charge happens inside summarizeProject.
	await requireCredits(user.id, 3);

	try {
		const { input, extracted } = buildRecordDocument({
			id: record.id,
			title: record.title,
			record_type: record.record_type,
			content,
			event_date: record.event_date,
			filename: record.file?.filename_download ?? null,
			application: { id: record.application.id, job: record.application.job ?? null }
		});

		await requireDocumentQuota(user.id, extracted.totalBytes, 1);

		const saved = await saveExtractedProject(
			{
				...input,
				profileId: actor.profileId,
				sideProjectId: kind === 'side_project' ? projectId : null,
				workExperienceProjectId: kind === 'work_experience_project' ? projectId : null
			},
			extracted
		);

		// Best-effort, exactly as for an upload: the copy stands if the LLM step
		// fails, and a reparse can fill the notes later.
		let summary: string | null = null;
		let keywords: string[] | null = null;
		const result = await summarizeProject(actor.profileId, extracted.files).catch(() => null);
		if (result) {
			await setProjectSummary(saved.id, result.summary, result.keywords);
			summary = result.summary || null;
			keywords = result.keywords.length > 0 ? result.keywords : null;
		}

		return json({
			success: true,
			unchanged: false,
			document: { ...saved, summary, keywords }
		});
	} catch (err) {
		if (err instanceof DocumentExtractError) error(400, err.message);
		throw err;
	}
};
