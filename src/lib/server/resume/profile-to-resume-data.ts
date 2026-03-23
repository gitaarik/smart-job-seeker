/**
 * Converts a profile from the database to ResumeData format.
 * Uses the existing export pipeline: DB → ExportedProfile → ResumeData
 */

import { buildProfileJsonExport } from "$lib/server/profile/export-profile-json";
import { convertExportToResumeData } from "$lib/resume/convert-export";
import type { ResumeData } from "./types";

/**
 * Load a profile from the database and return it as ResumeData.
 * This chains buildProfileJsonExport → convertExportToResumeData.
 */
export async function getProfileAsResumeData(
  profileId: number,
): Promise<ResumeData> {
  const { data: exported } = await buildProfileJsonExport(profileId);
  return convertExportToResumeData(exported);
}
