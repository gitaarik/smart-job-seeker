/**
 * Import media files from export
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { v4 as uuidv4 } from "uuid";
import { dbDirect } from "$lib/server/db";
import type { MediaFile } from "./types";

const UPLOADS_DIR = join(process.cwd(), "uploads");

interface MediaImportResult {
  imported: number;
  failed: number;
  errors: string[];
}

/**
 * Import media files from a ZIP export
 *
 * @param mediaFiles - Map of original path -> file buffer from the ZIP
 * @param mediaManifest - Array of MediaFile from export data
 * @param profileId - The newly created profile ID
 * @param mediaPathMapping - Map from import-data with keys like "profile:123:profile_photo_path"
 */
export async function importMediaFiles(
  mediaFiles: Map<string, Buffer>,
  mediaManifest: MediaFile[],
  profileId: number,
  mediaPathMapping: Map<string, string>,
): Promise<MediaImportResult> {
  const result: MediaImportResult = {
    imported: 0,
    failed: 0,
    errors: [],
  };

  // Build a reverse mapping: original path -> entity info
  const entityByOriginalPath = new Map<
    string,
    { entityType: string; entityId: number; field: string }
  >();

  for (const [key, originalPath] of mediaPathMapping) {
    const [entityType, entityIdStr, field] = key.split(":");
    const entityId = parseInt(entityIdStr);
    if (entityType && !isNaN(entityId) && field) {
      entityByOriginalPath.set(originalPath, { entityType, entityId, field });
    }
  }

  // Process each media file in the manifest
  for (const manifest of mediaManifest) {
    try {
      const buffer = mediaFiles.get(manifest.path);
      if (!buffer) {
        result.failed++;
        result.errors.push(`File not found in archive: ${manifest.path}`);
        continue;
      }

      // Determine the target entity (use new IDs from mediaPathMapping)
      const entityInfo = entityByOriginalPath.get(manifest.path);
      if (!entityInfo) {
        result.failed++;
        result.errors.push(`No entity mapping for: ${manifest.path}`);
        continue;
      }

      // Generate new file path with UUID
      const ext = getExtension(manifest.path);
      const subdir = getSubdirForEntityType(entityInfo.entityType);
      const newFilename = `${uuidv4()}${ext}`;
      const newRelativePath = `${subdir}/${newFilename}`;
      const newAbsolutePath = join(UPLOADS_DIR, newRelativePath);

      // Ensure directory exists
      await mkdir(dirname(newAbsolutePath), { recursive: true });

      // Write file
      await writeFile(newAbsolutePath, buffer);

      // Update database with new path
      await updateEntityMediaPath(
        entityInfo.entityType,
        entityInfo.entityId,
        entityInfo.field,
        newRelativePath,
        profileId,
      );

      result.imported++;
    } catch (error) {
      result.failed++;
      result.errors.push(
        `Failed to import ${manifest.path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return result;
}

/**
 * Get file extension from path
 */
function getExtension(path: string): string {
  const lastDot = path.lastIndexOf(".");
  if (lastDot === -1) return "";
  return path.substring(lastDot);
}

/**
 * Get upload subdirectory for entity type
 */
function getSubdirForEntityType(entityType: string): string {
  switch (entityType) {
    case "profile":
      return "profiles";
    case "work_experience":
      return "work-experiences";
    case "education":
      return "education";
    case "side_project":
      return "side-projects";
    default:
      return "misc";
  }
}

/**
 * Update entity's media path in database
 */
async function updateEntityMediaPath(
  entityType: string,
  entityId: number,
  field: string,
  newPath: string,
  profileId: number,
): Promise<void> {
  switch (entityType) {
    case "profile":
      if (field === "profile_photo_path") {
        await dbDirect.profiles.update({
          where: { id: profileId },
          data: { profile_photo_path: newPath },
        });
      }
      break;

    case "work_experience":
      if (field === "logo_path") {
        await dbDirect.work_experiences.update({
          where: { id: entityId },
          data: { logo_path: newPath },
        });
      }
      break;

    case "education":
      if (field === "logo_path") {
        await dbDirect.education.update({
          where: { id: entityId },
          data: { logo_path: newPath },
        });
      }
      break;

    case "side_project":
      if (field === "image_path") {
        await dbDirect.side_projects.update({
          where: { id: entityId },
          data: { image_path: newPath },
        });
      }
      break;
  }
}

/**
 * Delete old media files when overwriting a profile
 */
export async function deleteProfileMediaFiles(profileId: number): Promise<void> {
  const { unlink } = await import("node:fs/promises");

  // Get profile photo
  const profile = await dbDirect.profiles.findUnique({
    where: { id: profileId },
    select: { profile_photo_path: true },
  });

  if (profile?.profile_photo_path) {
    try {
      await unlink(join(UPLOADS_DIR, profile.profile_photo_path));
    } catch {
      // File might not exist
    }
  }

  // Get work experience media
  const workExps = await dbDirect.work_experiences.findMany({
    where: { profile_id: profileId },
    select: { logo_path: true },
  });

  for (const we of workExps) {
    if (we.logo_path) {
      try {
        await unlink(join(UPLOADS_DIR, we.logo_path));
      } catch {
        // File might not exist
      }
    }
  }

  // Get education media
  const education = await dbDirect.education.findMany({
    where: { profile_id: profileId },
    select: { logo_path: true },
  });

  for (const edu of education) {
    if (edu.logo_path) {
      try {
        await unlink(join(UPLOADS_DIR, edu.logo_path));
      } catch {
        // File might not exist
      }
    }
  }

  // Get side project media
  const sideProjects = await dbDirect.side_projects.findMany({
    where: { profile_id: profileId },
    select: { image_path: true },
  });

  for (const sp of sideProjects) {
    if (sp.image_path) {
      try {
        await unlink(join(UPLOADS_DIR, sp.image_path));
      } catch {
        // File might not exist
      }
    }
  }
}
