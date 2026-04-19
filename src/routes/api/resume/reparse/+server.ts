/**
 * POST /api/resume/reparse — Re-parse a file from an import log entry (admin-only)
 * GET  /api/resume/reparse?logId=N — Download the original file from an import log entry (admin-only)
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAuth } from "$lib/server/utils/api-helpers";
import {
  extractTextFromFile,
  isSupportedMimeType,
  mapJsonResumeToInternal,
  parseResumeWithLLM,
  validateJsonResume,
} from "$lib/server/resume";
import { getFile } from "$lib/server/files";
import { logImportEvent } from "$lib/server/import-log";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { import_logs } from "$lib/server/db/schema";

const FORMAT_TO_MIME: Record<string, string> = {
  PDF: "application/pdf",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  HTML: "text/html",
  "JSON Resume": "application/json",
};

function requireAdmin(locals: App.Locals) {
  const user = requireAuth(locals);
  const isAdmin =
    (user as { is_admin?: boolean }).is_admin ||
    !!(locals.adminUser as { is_admin?: boolean } | null)?.is_admin;
  if (!isAdmin) {
    error(403, "Admin access required");
  }
  return user;
}

async function getLogWithFile(logId: number) {
  const log = await db.query.import_logs.findFirst({
    where: eq(import_logs.id, logId),
  });
  if (!log) error(404, "Import log entry not found");
  if (!log.file_id) error(400, "No file stored for this log entry");
  return log;
}

/** GET — Download original file */
export const GET: RequestHandler = async ({ url, locals }) => {
  requireAdmin(locals);

  const logId = parseInt(url.searchParams.get("logId") || "", 10);
  if (!logId) error(400, "logId query parameter is required");

  const log = await getLogWithFile(logId);

  let buffer: Buffer;
  try {
    buffer = await getFile(log.file_id!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch file";
    error(500, message);
  }

  const mimeType = FORMAT_TO_MIME[log.file_format || ""] || "application/octet-stream";
  const fileName = log.file_name || "import-file";

  return new Response(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
};

/** POST — Re-parse file through LLM */
export const POST: RequestHandler = async ({ request, locals }) => {
  const user = requireAdmin(locals);

  const body = await request.json();
  const logId = body.logId as number;
  if (!logId) error(400, "logId is required");

  const log = await getLogWithFile(logId);

  let buffer: Buffer;
  try {
    buffer = await getFile(log.file_id!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch file from storage";
    error(500, message);
  }

  const fileName = log.file_name || "reparse-file";
  const mimeType = FORMAT_TO_MIME[log.file_format || ""] || "";

  // Handle JSON Resume files
  if (log.file_format === "JSON Resume" || fileName.endsWith(".json")) {
    try {
      const text = buffer.toString("utf-8");
      const jsonData = JSON.parse(text);

      validateJsonResume(jsonData);
      const parsedData = mapJsonResumeToInternal(jsonData);

      await logImportEvent(user, "parse", {
        fileName,
        fileFormat: "JSON Resume",
        parsedData,
        fileId: log.file_id!,
      });

      return json({ success: true, parsedData, fileName, fileFormat: "JSON Resume" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to parse JSON Resume file";
      await logImportEvent(user, "parse_error", {
        fileName,
        fileFormat: "JSON Resume",
        error: message,
        fileId: log.file_id!,
      }).catch(() => {});
      error(400, message);
    }
  }

  // Validate mime type
  if (!mimeType || !isSupportedMimeType(mimeType)) {
    error(400, `Unsupported file format: ${log.file_format || "unknown"}`);
  }

  try {
    const text = await extractTextFromFile(buffer, mimeType);
    const parsedData = await parseResumeWithLLM(text, user.id);

    await logImportEvent(user, "parse", {
      fileName,
      fileFormat: log.file_format || "unknown",
      parsedData,
      fileId: log.file_id!,
    });

    return json({
      success: true,
      parsedData,
      fileName,
      fileFormat: log.file_format,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse resume";
    await logImportEvent(user, "parse_error", {
      fileName,
      fileFormat: log.file_format || "unknown",
      error: message,
      fileId: log.file_id!,
    }).catch(() => {});
    error(400, message);
  }
};
