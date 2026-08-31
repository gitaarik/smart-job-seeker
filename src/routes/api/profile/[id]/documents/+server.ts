/**
 * Profile document ingestion.
 *
 *   POST /api/profile/[id]/documents  — upload files / ZIPs, or paste a note →
 *                                       extract → store
 *   GET  /api/profile/[id]/documents  — list this profile's document projects
 *
 * Each uploaded file (a loose doc or a ZIP) becomes one document "project".
 * Raw uploads are NOT retained — only extracted (secret-redacted) text.
 *
 * A pasted note arrives on the same endpoint as a `text` field, because it is
 * the same thing to everything downstream: extracted text attached to a
 * project, summarized, retrieved and cited alongside the files. Only its
 * provenance differs, and that is a column.
 *
 * Images are the exception to "raw uploads are NOT retained". There is no text
 * in a screenshot to keep instead of it, so the file itself is what is worth
 * having: it is re-encoded to a bounded WebP (`documents/media.ts`) and stored,
 * and the row points at it. Same endpoint, same drop zone, because from where
 * the user stands they are attaching a file to a project either way.
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, asc, desc, eq } from 'drizzle-orm';
import { profile_document_projects, work_experiences } from '$lib/server/db/schema';
import { projectBelongsToProfile } from '$lib/server/profile/project-ownership';
import type { ProjectKind } from '$lib/server/documents/project-corpus';
import { parseIntParam, requireAuth, requireProfileAccess } from '$lib/server/utils/api-helpers';
import { requireCredits } from '$lib/server/billing/require-credits';
import { requireDocumentQuota } from '$lib/server/billing/require-document-quota';
import {
	deriveNoteTitle,
	DocumentExtractError,
	type ExtractedProject,
	extractNote,
	extractUpload
} from '$lib/server/documents/extract';
import {
	type SaveDocumentProjectInput,
	type SaveMediaProjectInput,
	saveExtractedProject,
	saveMediaProject,
	setProjectSummary
} from '$lib/server/documents/store';
import { summarizeProject } from '$lib/server/documents/summarize';
import { extOf, isMediaExtension, sniffUploadKind } from '$lib/server/documents/sniff';
import {
	MAX_MEDIA_UPLOAD_BYTES,
	type NormalizedImage,
	normalizeImage
} from '$lib/server/documents/media';
import { uploadFile } from '$lib/server/files';

// Raw-upload safety cap (per file). Per-plan limits apply to extracted text.
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

function parseOptionalId(value: FormDataEntryValue | null): number | null {
	if (typeof value !== 'string' || value.trim() === '') return null;
	return /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;
}

/** A linked work-experience must belong to this profile. */
async function assertWorkExperienceOwned(id: number, profileId: number) {
	const row = await db.query.work_experiences.findFirst({
		where: and(eq(work_experiences.id, id), eq(work_experiences.profile_id, profileId)),
		columns: { id: true }
	});
	if (!row) error(400, 'Linked work experience not found on this profile');
}

/** A linked project of either kind must roll up to this profile. */
async function assertProjectOwned(kind: ProjectKind, id: number, profileId: number) {
	if (!(await projectBelongsToProfile(kind, id, profileId))) {
		error(400, 'Linked project not found on this profile');
	}
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const profileId = parseIntParam(params.id, 'profile');
	await requireProfileAccess(profileId, user.id);

	const form = await request.formData();
	const uploads: File[] = form
		.getAll('files')
		.filter((f): f is File => f instanceof File && f.size > 0);
	const single = form.get('file');
	if (single instanceof File && single.size > 0) uploads.push(single);
	const noteText = ((form.get('text') as string | null) ?? '').trim();
	if (uploads.length === 0 && !noteText) error(400, 'Nothing to save: add a file or write a note');

	const title = (form.get('title') as string | null)?.trim() || null;
	const workExperienceId = parseOptionalId(form.get('work_experience_id'));
	const workExperienceProjectId = parseOptionalId(form.get('work_experience_project_id'));
	const sideProjectId = parseOptionalId(form.get('side_project_id'));
	if (workExperienceId !== null) {
		await assertWorkExperienceOwned(workExperienceId, profileId);
	}
	if (workExperienceProjectId !== null) {
		await assertProjectOwned('work_experience_project', workExperienceProjectId, profileId);
	}
	if (sideProjectId !== null) {
		await assertProjectOwned('side_project', sideProjectId, profileId);
	}

	// Affordability, before the work rather than after it.
	//
	// Only the text path summarizes, so an image-only upload is charged nothing
	// and must not be refused for an empty balance — a bill for keeping a
	// screenshot the user can already see. But the authoritative answer to "is
	// this an image" needs the bytes, and reading and extracting them is the
	// expensive part this check exists to come before. So the *cost* question is
	// asked of the extensions, which is enough to be conservative: anything that
	// does not look like an image counts as possibly needing the LLM.
	const mightSummarize = !!noteText || uploads.some((f) => !isMediaExtension(extOf(f.name)));
	if (mightSummarize) {
		// Pre-flight floor for the per-project summarization cost; the real
		// per-token charge happens inside summarizeProject.
		await requireCredits(user.id, 3);
	}

	// Extract everything first so we can total the extracted bytes and gate on
	// the storage quota before writing any rows — and, for an image, before a
	// blob is written to disk that a refused upload would leave behind.
	type Pending =
		| { kind: 'text'; input: SaveDocumentProjectInput; extracted: ExtractedProject }
		| { kind: 'media'; input: Omit<SaveMediaProjectInput, 'fileId'>; image: NormalizedImage };
	const pending: Pending[] = [];
	const errors: { filename: string; error: string }[] = [];

	// A user-supplied title only makes sense for a single upload, and a note in
	// the same post has already claimed it.
	const uploadTitle = uploads.length === 1 && !noteText ? title : null;

	for (const file of uploads) {
		if (file.size > MAX_UPLOAD_BYTES) {
			errors.push({
				filename: file.name,
				error: 'File exceeds the 100MB upload limit.'
			});
			continue;
		}
		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			// Classified once here so the two paths cannot disagree about what a
			// file is; `extractUpload` sniffs again on its own, which costs a read
			// of the first bytes and keeps it correct when called from elsewhere.
			if (sniffUploadKind(bytes, file.name) === 'media') {
				if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
					errors.push({
						filename: file.name,
						error: `Image exceeds the ${Math.round(MAX_MEDIA_UPLOAD_BYTES / (1024 * 1024))}MB limit.`
					});
					continue;
				}
				pending.push({
					kind: 'media',
					input: {
						profileId,
						filename: file.name,
						title: uploadTitle,
						workExperienceId,
						workExperienceProjectId,
						sideProjectId
					},
					image: await normalizeImage({ filename: file.name, bytes })
				});
				continue;
			}
			const extracted = await extractUpload({ filename: file.name, bytes });
			pending.push({
				kind: 'text',
				input: {
					profileId,
					filename: file.name,
					title: uploadTitle,
					workExperienceId,
					workExperienceProjectId,
					sideProjectId
				},
				extracted
			});
		} catch (err) {
			if (err instanceof DocumentExtractError) {
				errors.push({ filename: file.name, error: err.message });
			} else {
				throw err;
			}
		}
	}

	if (noteText) {
		try {
			const noteTitle = deriveNoteTitle(title, noteText);
			pending.push({
				kind: 'text',
				input: {
					profileId,
					filename: null,
					title: noteTitle,
					workExperienceId,
					workExperienceProjectId,
					sideProjectId,
					kind: 'note',
					source: { type: 'paste' }
				},
				extracted: extractNote({ title: noteTitle, text: noteText })
			});
		} catch (err) {
			if (err instanceof DocumentExtractError) {
				errors.push({ filename: 'Note', error: err.message });
			} else {
				throw err;
			}
		}
	}

	const created = [];
	if (pending.length > 0) {
		// Images add no extracted text, so they cost nothing against the byte
		// budget — but each is still a document project, and the per-plan cap on
		// how many of those a profile may hold counts them like anything else.
		const totalBytes = pending.reduce(
			(sum, p) => sum + (p.kind === 'text' ? p.extracted.totalBytes : 0),
			0
		);
		await requireDocumentQuota(user.id, totalBytes, pending.length);

		for (const p of pending) {
			if (p.kind === 'media') {
				// The blob lands before the row that names it. The reverse would
				// point a row at a file that does not exist yet; this way a failure
				// between the two leaves an unreferenced `files` row, which is
				// exactly what the orphan sweep is for.
				const stored = await uploadFile({
					filename: p.image.filename,
					buffer: p.image.bytes,
					title: p.input.title ?? p.input.filename
				});
				const saved = await saveMediaProject({ ...p.input, fileId: stored.id });
				created.push({ ...saved, summary: null, keywords: null });
				continue;
			}
			const saved = await saveExtractedProject(p.input, p.extracted);
			// Summarize into reference notes + keywords (best-effort; the upload
			// still succeeds if the LLM step fails).
			let summary: string | null = null;
			let keywords: string[] | null = null;
			const result = await summarizeProject(profileId, p.extracted.files).catch(() => null);
			if (result) {
				await setProjectSummary(saved.id, result.summary, result.keywords);
				summary = result.summary || null;
				keywords = result.keywords.length > 0 ? result.keywords : null;
			}
			created.push({ ...saved, summary, keywords });
		}
	}

	return json({ success: true, created, errors });
};

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	const profileId = parseIntParam(params.id, 'profile');
	await requireProfileAccess(profileId, user.id);

	const documents = await db.query.profile_document_projects.findMany({
		where: eq(profile_document_projects.profile_id, profileId),
		orderBy: [asc(profile_document_projects.sort), desc(profile_document_projects.date_created)],
		columns: {
			id: true,
			kind: true,
			title: true,
			original_filename: true,
			status: true,
			summary: true,
			keywords: true,
			skipped: true,
			file_count: true,
			total_chars: true,
			total_bytes: true,
			work_experience_id: true,
			work_experience_project_id: true,
			date_created: true
		}
	});

	return json({ documents });
};
