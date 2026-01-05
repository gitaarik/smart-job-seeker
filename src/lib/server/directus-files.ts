import { deleteFile, uploadFiles } from "@directus/sdk";
import { createDirectusClient } from "./directus";
import type { Buffer } from "buffer";

interface UploadFileOptions {
  filename: string;
  buffer: Buffer;
  title?: string;
  description?: string;
  folder?: string;
}

interface UploadedFile {
  id: string; // UUID
  filename_disk: string;
  filename_download: string;
  type: string;
  filesize: number;
}

export async function uploadFileToDirectus(
  options: UploadFileOptions,
): Promise<UploadedFile> {
  const client = createDirectusClient();

  // Create FormData with file
  const formData = new FormData();
  const blob = new Blob([options.buffer]);
  formData.append("file", blob, options.filename);

  if (options.title) formData.append("title", options.title);
  if (options.description) formData.append("description", options.description);
  if (options.folder) formData.append("folder", options.folder);

  // Upload using Directus SDK
  const result = await client.request(uploadFiles(formData));

  // SDK returns the file object directly
  return result as UploadedFile;
}

export async function deleteFileFromDirectus(fileId: string): Promise<void> {
  const client = createDirectusClient();
  await client.request(deleteFile(fileId));
}
