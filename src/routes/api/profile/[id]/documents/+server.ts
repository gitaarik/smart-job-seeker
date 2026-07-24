/**
 * Profile document ingestion.
 *
 *   POST /api/profile/[id]/documents  — upload files / ZIPs → extract → store
 *   GET  /api/profile/[id]/documents  — list this profile's document projects
 *
 * Each uploaded file (a loose doc or a ZIP) becomes one document "project".
 * Raw uploads are NOT retained — only extracted (secret-redacted) text.
 */

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  profile_document_projects,
  work_experience_projects,
  work_experiences,
} from "$lib/server/db/schema";
import {
  parseIntParam,
  requireAuth,
  requireProfileAccess,
} from "$lib/server/utils/api-helpers";
import { requireCredits } from "$lib/server/billing/require-credits";
import { requireDocumentQuota } from "$lib/server/billing/require-document-quota";
import {
  DocumentExtractError,
  type ExtractedProject,
  extractUpload,
} from "$lib/server/documents/extract";
import {
  type SaveDocumentProjectInput,
  saveExtractedProject,
  setProjectSummary,
} from "$lib/server/documents/store";
import { summarizeProject } from "$lib/server/documents/summarize";

// Raw-upload safety cap (per file). Per-plan limits apply to extracted text.
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

function parseOptionalId(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;
}

/** A linked work-experience must belong to this profile. */
async function assertWorkExperienceOwned(id: number, profileId: number) {
  const row = await db.query.work_experiences.findFirst({
    where: and(
      eq(work_experiences.id, id),
      eq(work_experiences.profile_id, profileId),
    ),
    columns: { id: true },
  });
  if (!row) error(400, "Linked work experience not found on this profile");
}

/** A linked project must roll up to a work-experience on this profile. */
async function assertWorkExperienceProjectOwned(id: number, profileId: number) {
  const row = await db.query.work_experience_projects.findFirst({
    where: eq(work_experience_projects.id, id),
    columns: { id: true },
    with: { work_experience: { columns: { profile_id: true } } },
  });
  if (!row || row.work_experience?.profile_id !== profileId) {
    error(400, "Linked project not found on this profile");
  }
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  const profileId = parseIntParam(params.id, "profile");
  await requireProfileAccess(profileId, user.id);
  // Pre-flight affordability floor for the per-project summarization LLM cost;
  // the real per-token charge happens inside summarizeProject.
  await requireCredits(user.id, 3);

  const form = await request.formData();
  const uploads: File[] = form
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const single = form.get("file");
  if (single instanceof File && single.size > 0) uploads.push(single);
  if (uploads.length === 0) error(400, "No files uploaded");

  const title = (form.get("title") as string | null)?.trim() || null;
  const workExperienceId = parseOptionalId(form.get("work_experience_id"));
  const workExperienceProjectId = parseOptionalId(
    form.get("work_experience_project_id"),
  );
  if (workExperienceId !== null) {
    await assertWorkExperienceOwned(workExperienceId, profileId);
  }
  if (workExperienceProjectId !== null) {
    await assertWorkExperienceProjectOwned(workExperienceProjectId, profileId);
  }

  // Extract everything first so we can total the extracted bytes and gate on
  // the storage quota before writing any rows.
  const pending: {
    input: SaveDocumentProjectInput;
    extracted: ExtractedProject;
  }[] = [];
  const errors: { filename: string; error: string }[] = [];

  for (const file of uploads) {
    if (file.size > MAX_UPLOAD_BYTES) {
      errors.push({
        filename: file.name,
        error: "File exceeds the 100MB upload limit.",
      });
      continue;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const extracted = await extractUpload({ filename: file.name, bytes });
      pending.push({
        input: {
          profileId,
          filename: file.name,
          // A user-supplied title only makes sense for a single upload.
          title: uploads.length === 1 ? title : null,
          workExperienceId,
          workExperienceProjectId,
        },
        extracted,
      });
    } catch (err) {
      if (err instanceof DocumentExtractError) {
        errors.push({ filename: file.name, error: err.message });
      } else {
        throw err;
      }
    }
  }

  const created = [];
  if (pending.length > 0) {
    const totalBytes = pending.reduce((s, p) => s + p.extracted.totalBytes, 0);
    await requireDocumentQuota(user.id, totalBytes, pending.length);
    for (const p of pending) {
      const saved = await saveExtractedProject(p.input, p.extracted);
      // Summarize into reference notes + keywords (best-effort; the upload
      // still succeeds if the LLM step fails).
      let summary: string | null = null;
      let keywords: string[] | null = null;
      const result = await summarizeProject(profileId, p.extracted.files)
        .catch(() => null);
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
  const profileId = parseIntParam(params.id, "profile");
  await requireProfileAccess(profileId, user.id);

  const documents = await db.query.profile_document_projects.findMany({
    where: eq(profile_document_projects.profile_id, profileId),
    orderBy: [
      asc(profile_document_projects.sort),
      desc(profile_document_projects.date_created),
    ],
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
      date_created: true,
    },
  });

  return json({ documents });
};
