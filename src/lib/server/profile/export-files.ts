/**
 * Profile Export File Service
 * Handles querying profile_exports table and retrieving files
 */

import { dbDirect as db } from "$lib/server/db";
import { getFile } from "$lib/server/files";

/**
 * Query parameters for finding profile exports
 */
interface ExportQuery {
  profileId: number;
  exportType: "resume" | "cv" | "structured_data";
  fileType: "pdf" | "html" | "json" | "txt" | "docx";
  exportFormat?: string; // Optional version/variant filter
}

/**
 * Find the latest export matching the given criteria
 * @param query - Export query parameters
 * @returns Export record with file details, or null if not found
 */
export async function getLatestExport(query: ExportQuery) {
  const whereClause: {
    profile_id: number;
    export_type: string;
    file_type: string;
    status: string;
    export_format?: string;
  } = {
    profile_id: query.profileId,
    export_type: query.exportType,
    file_type: query.fileType,
    status: "published",
  };

  // Filter by version/variant if provided
  if (query.exportFormat) {
    whereClause.export_format = query.exportFormat;
  }

  return db.query.profile_exports.findFirst({
    where: whereClause,
    orderBy: { date_updated: "desc" },
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
