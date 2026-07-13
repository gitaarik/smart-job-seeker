/**
 * Profile Export File Service
 * Handles querying profile_exports table and retrieving files
 */

import { dbDirect as db } from "$lib/server/db";
import { eq, and, desc, isNull } from "drizzle-orm";
import { profile_exports } from "$lib/server/db/schema";
import { getFile } from "$lib/server/files";

/**
 * Query parameters for finding profile exports
 */
interface ExportQuery {
  profileId: number;
  exportType: "resume" | "cv" | "structured_data";
  fileType: "pdf" | "html" | "json" | "txt" | "docx";
  exportFormat?: string; // Optional version/variant filter
  // Presentation template filter. `null`/undefined selects the default-template
  // export (profile_exports.template IS NULL); a string matches that template.
  template?: string | null;
}

/**
 * Find the latest export matching the given criteria
 * @param query - Export query parameters
 * @returns Export record with file details, or null if not found
 */
export async function getLatestExport(query: ExportQuery) {
  const conditions = [
    eq(profile_exports.profile_id, query.profileId),
    eq(profile_exports.export_type, query.exportType),
    eq(profile_exports.file_type, query.fileType),
    eq(profile_exports.status, "published"),
  ];

  // Filter by version/variant if provided
  if (query.exportFormat) {
    conditions.push(eq(profile_exports.export_format, query.exportFormat));
  }

  // Filter by presentation template: a string matches that template; otherwise
  // select the default-template export (template IS NULL).
  conditions.push(
    query.template
      ? eq(profile_exports.template, query.template)
      : isNull(profile_exports.template),
  );

  return db.query.profile_exports.findFirst({
    where: and(...conditions),
    orderBy: desc(profile_exports.date_updated),
  });
}

/**
 * Retrieve file content by UUID
 * @param fileUuid - The UUID of the file
 * @returns Buffer containing the file data
 */
export async function getExportFileBuffer(fileUuid: string): Promise<Buffer> {
  return getFile(fileUuid);
}

/**
 * Get latest export and its file content in one call
 * @param query - Export query parameters
 * @returns Object with export metadata and file buffer, or null if not found
 */
export async function getLatestExportWithFile(query: ExportQuery) {
  const exportRecord = await getLatestExport(query);

  if (!exportRecord) {
    return null;
  }

  const fileBuffer = await getExportFileBuffer(exportRecord.file_id);

  return {
    export: exportRecord,
    buffer: fileBuffer,
  };
}
