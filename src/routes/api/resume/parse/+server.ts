/**
 * POST /api/resume/parse
 * Parses a CV/resume file (PDF, DOCX, HTML) or JSON Resume and returns ResumeData.
 * Used by both /dashboard/profile/create and /dashboard/export/import.
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAuth } from "$lib/server/utils/api-helpers";
import {
  extractTextFromFile,
  getFormatName,
  isSupportedMimeType,
  mapJsonResumeToInternal,
  parseResumeWithLLM,
  validateJsonResume,
} from "$lib/server/resume";
import type { ResumeData } from "$lib/server/resume/types";
import { uploadFile } from "$lib/server/files";
import { logImportEvent } from "$lib/server/import-log";
import { requireCredits } from "$lib/server/billing/credits";

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);
  // AI resume parse costs ~3 credits; JSON import is free (handled separately below)
  await requireCredits(user.id, 3);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    error(400, "Please select a file to upload");
  }

  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    error(400, "File is too large. Maximum size is 10MB.");
  }

  // Handle JSON Resume files
  if (file.type === "application/json" || file.name.endsWith(".json")) {
    // Upload JSON file for logging
    let jsonFileId: string | undefined;
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploadResult = await uploadFile({
        filename: file.name,
        buffer,
        title: `CV Upload (JSON) - ${user.email || user.id}`,
        description: "JSON Resume uploaded during profile import",
      });
      jsonFileId = uploadResult.id;
    } catch {
      // Non-critical — continue without file storage
    }

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      validateJsonResume(jsonData);
      const parsedData = mapJsonResumeToInternal(jsonData);

      await logImportEvent(user, "parse", { fileName: file.name, fileFormat: "JSON Resume", parsedData, fileId: jsonFileId });
  

      return json({
        success: true,
        parsedData,
        fileName: file.name,
        fileFormat: "JSON Resume",
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to parse JSON Resume file";
      await logImportEvent(user, "parse_error", { fileName: file.name, fileFormat: "JSON Resume", error: message, fileId: jsonFileId }).catch(() => {});
      error(400, message);
    }
  }

  // Validate file type
  if (!isSupportedMimeType(file.type)) {
    error(
      400,
      `Unsupported file type: ${file.type}. Please upload a PDF, DOCX, or HTML file.`,
    );
  }

  let fileId: string | undefined;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload file
    const uploadResult = await uploadFile({
      filename: file.name,
      buffer,
      title: `CV Upload - ${user.email || user.id}`,
      description: "CV/Resume uploaded during profile import",
    });
    fileId = uploadResult.id;

    // Extract text from file
    const text = await extractTextFromFile(buffer, file.type);

    // Parse with LLM
    const parsedData = await parseResumeWithLLM(text, user.id);

    await logImportEvent(user, "parse", { fileName: file.name, fileFormat: getFormatName(file.type), parsedData, fileId });


    return json({
      success: true,
      parsedData,
      fileId,
      fileName: file.name,
      fileFormat: getFormatName(file.type),
    });
  } catch (err) {
    // Keep the uploaded file for debugging — it's referenced in the import log
    const message =
      err instanceof Error ? err.message : "Failed to parse resume";
    await logImportEvent(user, "parse_error", { fileName: file.name, fileFormat: getFormatName(file.type), error: message, fileId }).catch(() => {});
    error(400, message);
  }
};
