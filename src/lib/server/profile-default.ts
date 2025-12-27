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
  // Get config to find default profile ID
  const config = await db.config.findFirst({
    select: { default_profile: true },
  });

  if (!config?.default_profile) {
    return null;
  }

  // Fetch the profile with all relations
  return db.profiles.findUnique({
    where: { id: config.default_profile },
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
 * Set a profile as default
 * @param profileId Profile ID to set as default
 */
export async function setDefaultProfile(profileId: number) {
  // Get or create config record
  const config = await db.config.findFirst();

  if (config) {
    // Update existing config
    return db.config.update({
      where: { id: config.id },
      data: { default_profile: profileId },
    });
  } else {
    // Create new config
    return db.config.create({
      data: { default_profile: profileId },
    });
  }
}

/**
 * Get default profile ID only (lightweight query for scripts)
 */
export async function getDefaultProfileId(): Promise<number | null> {
  const config = await db.config.findFirst({
    select: { default_profile: true },
  });

  return config?.default_profile ?? null;
}

// Export the standard include structure for use in other files
export { PROFILE_INCLUDE };
