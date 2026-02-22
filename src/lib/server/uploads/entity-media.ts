/**
 * Entity media upload handler
 * Generic server-side handler for uploading media to any entity type
 */

import { writeFile, mkdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import { dbDirect } from "$lib/server/db";

const UPLOADS_DIR = join(process.cwd(), "uploads");

// Allowed entity types and their valid fields
const ENTITY_CONFIG: Record<string, { fields: string[]; table: string }> = {
  profile: { fields: ["profile_photo_path"], table: "profiles" },
  work_experience: { fields: ["logo_path", "banner_path"], table: "work_experiences" },
  education: { fields: ["logo_path", "banner_path"], table: "education" },
  side_project: { fields: ["image_path", "banner_path"], table: "side_projects" },
};

interface UploadResult {
  success: boolean;
  path?: string;
  url?: string;
  error?: string;
}

interface UploadOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

const DEFAULT_OPTIONS: UploadOptions = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 85,
};

/**
 * Validate that user owns the entity via profile
 */
export async function validateEntityOwnership(
  entityType: string,
  entityId: number,
  userId: string,
): Promise<boolean> {
  const config = ENTITY_CONFIG[entityType];
  if (!config) return false;

  let profileId: number | null = null;

  switch (entityType) {
    case "profile": {
      // For profiles, entityId is the profile id directly
      profileId = entityId;
      break;
    }
    case "work_experience": {
      const entity = await dbDirect.work_experiences.findUnique({
        where: { id: entityId },
        select: { profile: true },
      });
      profileId = entity?.profile ?? null;
      break;
    }
    case "education": {
      const entity = await dbDirect.education.findUnique({
        where: { id: entityId },
        select: { profile: true },
      });
      profileId = entity?.profile ?? null;
      break;
    }
    case "side_project": {
      const entity = await dbDirect.side_projects.findUnique({
        where: { id: entityId },
        select: { profile: true },
      });
      profileId = entity?.profile ?? null;
      break;
    }
  }

  if (!profileId) return false;

  // Check profile ownership
  const profile = await dbDirect.profiles.findFirst({
    where: { id: profileId, user_id: userId },
    select: { id: true },
  });

  return !!profile;
}

/**
 * Validate entity type and field
 */
export function validateEntityField(
  entityType: string,
  field: string,
): boolean {
  const config = ENTITY_CONFIG[entityType];
  if (!config) return false;
  return config.fields.includes(field);
}

/**
 * Save entity media file
 */
export async function saveEntityMedia(
  entityType: string,
  entityId: number,
  field: string,
  file: File,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return { success: false, error: "Invalid file type" };
  }

  // Validate file size (5MB max)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return { success: false, error: "File too large (max 5MB)" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Process with Sharp
    let processed = sharp(buffer).rotate(); // Auto-rotate based on EXIF

    // Resize if needed
    const metadata = await sharp(buffer).metadata();
    if (
      (metadata.width && metadata.width > opts.maxWidth!) ||
      (metadata.height && metadata.height > opts.maxHeight!)
    ) {
      processed = processed.resize(opts.maxWidth, opts.maxHeight, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Convert to JPEG for consistency (except for PNGs with transparency)
    let ext = ".jpg";
    let mimeType = "image/jpeg";

    if (file.type === "image/png") {
      // Check if PNG has transparency
      const hasAlpha = metadata.hasAlpha;
      if (hasAlpha) {
        processed = processed.png({ quality: opts.quality });
        ext = ".png";
        mimeType = "image/png";
      } else {
        processed = processed.jpeg({ quality: opts.quality });
      }
    } else {
      processed = processed.jpeg({ quality: opts.quality });
    }

    // Strip EXIF data
    processed = processed.withMetadata({ orientation: undefined });

    const outputBuffer = await processed.toBuffer();

    // Generate filename and path
    const subdir = entityType.replace("_", "-") + "s";
    const filename = `${uuidv4()}${ext}`;
    const relativePath = `${subdir}/${filename}`;
    const absolutePath = join(UPLOADS_DIR, relativePath);

    // Ensure directory exists
    await mkdir(dirname(absolutePath), { recursive: true });

    // Write file
    await writeFile(absolutePath, outputBuffer);

    // Update database
    await updateEntityMediaPath(entityType, entityId, field, relativePath);

    return {
      success: true,
      path: relativePath,
      url: `/uploads/${relativePath}`,
    };
  } catch (error) {
    console.error("Failed to save entity media:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Delete entity media file
 */
export async function deleteEntityMedia(
  entityType: string,
  entityId: number,
  field: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current path
    const currentPath = await getEntityMediaPath(entityType, entityId, field);

    if (currentPath) {
      // Delete file
      try {
        await unlink(join(UPLOADS_DIR, currentPath));
      } catch {
        // File might not exist
      }
    }

    // Clear database field
    await updateEntityMediaPath(entityType, entityId, field, null);

    return { success: true };
  } catch (error) {
    console.error("Failed to delete entity media:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}

/**
 * Get current media path for entity
 */
async function getEntityMediaPath(
  entityType: string,
  entityId: number,
  field: string,
): Promise<string | null> {
  switch (entityType) {
    case "profile": {
      const entity = await dbDirect.profiles.findUnique({
        where: { id: entityId },
        select: { profile_photo_path: true },
      });
      if (field === "profile_photo_path") return entity?.profile_photo_path ?? null;
      return null;
    }
    case "work_experience": {
      const entity = await dbDirect.work_experiences.findUnique({
        where: { id: entityId },
        select: { logo_path: true, banner_path: true },
      });
      if (field === "logo_path") return entity?.logo_path ?? null;
      if (field === "banner_path") return entity?.banner_path ?? null;
      return null;
    }
    case "education": {
      const entity = await dbDirect.education.findUnique({
        where: { id: entityId },
        select: { logo_path: true, banner_path: true },
      });
      if (field === "logo_path") return entity?.logo_path ?? null;
      if (field === "banner_path") return entity?.banner_path ?? null;
      return null;
    }
    case "side_project": {
      const entity = await dbDirect.side_projects.findUnique({
        where: { id: entityId },
        select: { image_path: true, banner_path: true },
      });
      if (field === "image_path") return entity?.image_path ?? null;
      if (field === "banner_path") return entity?.banner_path ?? null;
      return null;
    }
    default:
      return null;
  }
}

/**
 * Update entity media path in database
 */
async function updateEntityMediaPath(
  entityType: string,
  entityId: number,
  field: string,
  path: string | null,
): Promise<void> {
  switch (entityType) {
    case "profile":
      if (field === "profile_photo_path") {
        await dbDirect.profiles.update({
          where: { id: entityId },
          data: { profile_photo_path: path, date_updated: new Date() },
        });
      }
      break;
    case "work_experience":
      if (field === "logo_path") {
        await dbDirect.work_experiences.update({
          where: { id: entityId },
          data: { logo_path: path },
        });
      } else if (field === "banner_path") {
        await dbDirect.work_experiences.update({
          where: { id: entityId },
          data: { banner_path: path },
        });
      }
      break;
    case "education":
      if (field === "logo_path") {
        await dbDirect.education.update({
          where: { id: entityId },
          data: { logo_path: path },
        });
      } else if (field === "banner_path") {
        await dbDirect.education.update({
          where: { id: entityId },
          data: { banner_path: path },
        });
      }
      break;
    case "side_project":
      if (field === "image_path") {
        await dbDirect.side_projects.update({
          where: { id: entityId },
          data: { image_path: path },
        });
      } else if (field === "banner_path") {
        await dbDirect.side_projects.update({
          where: { id: entityId },
          data: { banner_path: path },
        });
      }
      break;
  }
}
