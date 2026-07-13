import { dbDirect as db } from "$lib/server/db";
import { profile_exports } from "$lib/server/db/schema";
import { deleteFile, uploadFile } from "$lib/server/files";
import type { Buffer } from "buffer";

interface CreateExportOptions {
  profileId: number;
  fileBuffer: Buffer;
  filename: string;
  fileType: "pdf" | "html" | "json" | "txt" | "docx";
  exportType: "resume" | "cv" | "structured_data";
  exportFormat?: string;
  template?: string | null;
  description?: string;
  sourceUrl?: string;
}

export async function createProfileExport(
  options: CreateExportOptions,
): Promise<number> {
  let uploadedFile;

  try {
    // Upload file
    uploadedFile = await uploadFile({
      filename: options.filename,
      buffer: options.fileBuffer,
      title: options.filename,
      description: options.description,
    });

    // Create database record
    const [exportRecord] = await db.insert(profile_exports).values({
      profile_id: options.profileId,
      file_id: uploadedFile.id,
      file_type: options.fileType,
      export_type: options.exportType,
      export_format: options.exportFormat,
      template: options.template ?? null,
      description: options.description,
      source_url: options.sourceUrl,
      date_created: new Date(),
      date_updated: new Date(),
    }).returning();

    return exportRecord.id;
  } catch (error) {
    // Cleanup: delete uploaded file if database insert fails
    if (uploadedFile?.id) {
      await deleteFile(uploadedFile.id).catch(() => {});
    }
    throw error;
  }
}
