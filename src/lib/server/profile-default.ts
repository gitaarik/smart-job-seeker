/**
 * Profile default helper module
 * Centralized functions for default profile logic
 */

import { dbDirect as db } from "$lib/db";

/**
 * Standard include structure used across all profile queries
 * Matches the pattern from profile-loader.ts and portfolio page
 */
const PROFILE_INCLUDE = {
  languages: { orderBy: { sort: "asc" as const } },
  highlights: { orderBy: { sort: "asc" as const } },
  tech_skill_categories: {
    include: {
      tech_skills: { orderBy: { sort: "asc" as const } },
    },
    orderBy: { sort: "asc" as const },
  },
  work_experiences: {
    include: {
      work_experience_achievements: { orderBy: { sort: "asc" as const } },
      work_experience_technologies: { orderBy: { sort: "asc" as const } },
    },
    orderBy: { sort: "asc" as const },
  },
  education: { orderBy: { sort: "asc" as const } },
  side_projects: {
    include: {
      side_project_achievements: { orderBy: { sort: "asc" as const } },
      side_project_technologies: { orderBy: { sort: "asc" as const } },
    },
    orderBy: { sort: "asc" as const },
  },
  references: { orderBy: { sort: "asc" as const } },
  profile_versions: {
    include: {
      profile_version_extensions_profile_version_extensions_extendedToprofile_versions:
        {},
    },
    orderBy: { sort: "asc" as const },
    where: { status: { equals: "published" } },
  },
} as const;

/**
 * Get the default profile with all relations
 */
export async function getDefaultProfile() {
  return db.profiles.findFirst({
    where: { is_default: true },
    include: PROFILE_INCLUDE,
  });
}

/**
 * Get profile by ID or fallback to default
 * @param profileId Optional profile ID
 * @returns Profile with all relations, or null if not found
 */
export async function getProfileOrDefault(profileId?: number) {
  if (profileId !== undefined) {
    const profile = await db.profiles.findUnique({
      where: { id: profileId },
      include: PROFILE_INCLUDE,
    });
    if (profile) return profile;
  }

  return getDefaultProfile();
}

/**
 * Set a profile as default (unsets all others)
 * @param profileId Profile ID to set as default
 */
export async function setDefaultProfile(profileId: number) {
  // First unset all other defaults
  await db.profiles.updateMany({
    where: { is_default: true },
    data: { is_default: false },
  });

  // Then set the new default
  return db.profiles.update({
    where: { id: profileId },
    data: { is_default: true },
  });
}

/**
 * Get default profile ID only (lightweight query for scripts)
 */
export async function getDefaultProfileId(): Promise<number | null> {
  const profile = await db.profiles.findFirst({
    where: { is_default: true },
    select: { id: true },
  });

  return profile?.id ?? null;
}

// Export the standard include structure for use in other files
export { PROFILE_INCLUDE };
