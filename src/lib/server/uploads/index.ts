/**
 * Local file upload utilities with Sharp image processing
 */

import sharp from "sharp";
import { randomUUID } from "crypto";
import { mkdir, unlink, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// Base uploads directory - relative to project root
const UPLOADS_DIR = "uploads";

// Supported image types
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// File extension mapping
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

interface UploadOptions {
  /** Maximum file size in bytes (default: 5MB) */
  maxSize?: number;
  /** Resize to max width (maintains aspect ratio) */
  maxWidth?: number;
  /** Resize to max height (maintains aspect ratio) */
  maxHeight?: number;
  /** JPEG/WebP quality (1-100, default: 85) */
  quality?: number;
}

interface UploadResult {
  /** Relative path from uploads dir (e.g., "profiles/abc123.jpg") */
  path: string;
  /** Original filename */
  originalName: string;
  /** File size in bytes (after processing) */
  size: number;
  /** MIME type */
  mimeType: string;
}

/**
 * Validate an uploaded file
 */
export function validateUpload(
  file: File,
  options: UploadOptions = {},
): { valid: true } | { valid: false; error: string } {
  const maxSize = options.maxSize ?? 5 * 1024 * 1024; // 5MB default

  // Check file size
  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / 1024 / 1024);
    return { valid: false, error: `File too large. Maximum size is ${maxMB}MB.` };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.",
    };
  }

  return { valid: true };
}

/**
 * Save a profile photo
 * Processes the image (resize, optimize) and saves to uploads/profiles/
 */
export async function saveProfilePhoto(
  file: File,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const maxWidth = options.maxWidth ?? 800;
  const maxHeight = options.maxHeight ?? 800;
  const quality = options.quality ?? 85;

  // Generate UUID filename
  const uuid = randomUUID();
  const ext = MIME_TO_EXT[file.type] || "jpg";
  const filename = `${uuid}.${ext}`;
  const relativePath = `profiles/${filename}`;

  // Ensure directory exists
  const dir = path.join(UPLOADS_DIR, "profiles");
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  // Read file into buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Process with Sharp
  let sharpInstance = sharp(buffer);

  // Get metadata to check dimensions
  const metadata = await sharpInstance.metadata();

  // Resize if needed (maintains aspect ratio)
  if (
    (metadata.width && metadata.width > maxWidth) ||
    (metadata.height && metadata.height > maxHeight)
  ) {
    sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // Strip EXIF data for privacy, auto-rotate based on EXIF
  sharpInstance = sharpInstance.rotate();

  // Optimize based on format
  if (file.type === "image/jpeg") {
    sharpInstance = sharpInstance.jpeg({ quality, mozjpeg: true });
  } else if (file.type === "image/png") {
    sharpInstance = sharpInstance.png({ compressionLevel: 9 });
  } else if (file.type === "image/webp") {
    sharpInstance = sharpInstance.webp({ quality });
  }
  // GIF is passed through as-is

  // Save to file
  const outputPath = path.join(UPLOADS_DIR, relativePath);
  const outputInfo = await sharpInstance.toFile(outputPath);

  return {
    path: relativePath,
    originalName: file.name,
    size: outputInfo.size,
    mimeType: file.type,
  };
}

/**
 * Delete a file from uploads
 */
export async function deleteUpload(relativePath: string): Promise<void> {
  if (!relativePath) return;

  const fullPath = path.join(UPLOADS_DIR, relativePath);

  // Security: ensure path is within uploads directory
  const resolvedPath = path.resolve(fullPath);
  const uploadsPath = path.resolve(UPLOADS_DIR);
  if (!resolvedPath.startsWith(uploadsPath)) {
    throw new Error("Invalid file path");
  }

  try {
    await unlink(fullPath);
  } catch (err) {
    // Ignore if file doesn't exist
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}

/**
 * Read a file from uploads
 */
export async function readUpload(
  relativePath: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!relativePath) return null;

  const fullPath = path.join(UPLOADS_DIR, relativePath);

  // Security: ensure path is within uploads directory
  const resolvedPath = path.resolve(fullPath);
  const uploadsPath = path.resolve(UPLOADS_DIR);
  if (!resolvedPath.startsWith(uploadsPath)) {
    throw new Error("Invalid file path");
  }

  try {
    const buffer = await readFile(fullPath);

    // Determine MIME type from extension
    const ext = path.extname(relativePath).toLowerCase().slice(1);
    const mimeType =
      Object.entries(MIME_TO_EXT).find(([, e]) => e === ext)?.[0] ||
      "application/octet-stream";

    return { buffer, mimeType };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Get the public URL for an uploaded file
 */
export function getUploadUrl(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null;
  return `/uploads/${relativePath}`;
}
