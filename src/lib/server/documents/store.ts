/**
 * Persistence for extracted document projects.
 *
 * Writes one `profile_document_projects` row (the upload/archive unit) plus a
 * `profile_document_files` row per extracted source file. The raw upload is not
 * stored — only extracted text. The per-project `summary` is filled later by
 * the summarizer step.
 */

import { dbDirect as db } from "$lib/server/db";
import {
  profile_document_files,
  profile_document_projects,
} from "$lib/server/db/schema";
import type { ExtractedProject } from "./extract";

export interface SaveDocumentProjectInput {
  profileId: number;
  filename: string;
  title?: string | null;
  workExperienceId?: number | null;
  workExperienceProjectId?: number | null;
}

export interface SavedDocumentProject {
  id: number;
  status: string;
  kind: "archive" | "file";
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
  extracted: ExtractedProject,
): Promise<SavedDocumentProject> {
  const now = new Date();
  const status = extracted.truncated ? "partial" : "extracted";
  const title = input.title?.trim() || input.filename;

  const [project] = await db
    .insert(profile_document_projects)
    .values({
      profile_id: input.profileId,
      work_experience_id: input.workExperienceId ?? null,
      work_experience_project_id: input.workExperienceProjectId ?? null,
      kind: extracted.kind,
      title,
      original_filename: input.filename,
      status,
      skipped: extracted.skipped.length > 0 ? extracted.skipped : null,
      file_count: extracted.files.length,
      total_chars: extracted.totalChars,
      total_bytes: extracted.totalBytes,
      date_created: now,
      date_updated: now,
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
        date_created: now,
      })),
    );
  }

  return {
    id: project.id,
    status,
    kind: extracted.kind,
    title,
    fileCount: extracted.files.length,
    totalChars: extracted.totalChars,
    totalBytes: extracted.totalBytes,
    truncated: extracted.truncated,
    skippedCount: extracted.skipped.length,
    secretsRedacted: extracted.secretsRedacted,
  };
}
