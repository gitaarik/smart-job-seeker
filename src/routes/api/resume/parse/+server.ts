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
import {
  deleteFileFromDirectus,
  uploadFileToDirectus,
} from "$lib/server/directus/files";

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);

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
    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      validateJsonResume(jsonData);
      const parsedData = mapJsonResumeToInternal(jsonData);

      return json({
        success: true,
        parsedData,
        fileName: file.name,
        fileFormat: "JSON Resume",
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to parse JSON Resume file";
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

    // Upload to Directus
    const uploadResult = await uploadFileToDirectus({
      filename: file.name,
      buffer,
      title: `CV Upload - ${user.email || user.id}`,
      description: "CV/Resume uploaded during profile import",
    });
    fileId = uploadResult.id;

    // Extract text from file
    const text = await extractTextFromFile(buffer, file.type);

    // Parse with LLM
    const parsedData = await parseResumeWithLLM(text);

    return json({
      success: true,
      parsedData,
      fileId,
      fileName: file.name,
      fileFormat: getFormatName(file.type),
    });
  } catch (err) {
    // Clean up uploaded file if parsing failed
    if (fileId) {
      try {
        await deleteFileFromDirectus(fileId);
      } catch {
        // Ignore cleanup errors
      }
    }

    const message =
      err instanceof Error ? err.message : "Failed to parse resume";
    error(400, message);
  }
};
