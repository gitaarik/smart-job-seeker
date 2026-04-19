/**
 * Utility functions for job matching - profile skill extraction
 */

import { dbDirect as db } from "$lib/server/db";

/**
 * Extract tech skills from a profile
 * @param profileId - Profile ID to extract skills from
 * @returns Array of skill names
 */
export async function getProfileSkills(profileId: number): Promise<string[]> {
  const skills = await db.query.tech_skills.findMany({
    where: {
      tech_skill_categories: {
        profile_id: profileId,
      },
    },
    select: {
      name: true,
    },
  });

  return skills
    .map((s) => s.name)
    .filter((name): name is string => !!name);
}

/**
 * Extract tech skills from a profile with proficiency info.
 * Returns a map of lowercase skill name -> proficiency level.
 * "strong" = expert/proficient or 3+ years
 * "weak" = beginner/intermediate or <3 years (when level is set)
 */
export async function getProfileSkillLevels(
  profileId: number,
): Promise<Record<string, "strong" | "weak">> {
  const skills = await db.query.tech_skills.findMany({
    where: {
      tech_skill_categories: {
        profile_id: profileId,
      },
    },
    select: {
      name: true,
      level: true,
      years_experience: true,
    },
  });

  const result: Record<string, "strong" | "weak"> = {};
  for (const skill of skills) {
    if (!skill.name) continue;
    const key = skill.name.toLowerCase();

    // Determine proficiency
    const level = skill.level?.toLowerCase();
    const years = skill.years_experience;

    if (level === "beginner" || level === "intermediate") {
      result[key] = "weak";
    } else if (level === "expert" || level === "proficient") {
      result[key] = "strong";
    } else if (years !== null && years !== undefined && years < 3) {
      // No level set but few years of experience
      result[key] = "weak";
    } else {
      // No level set, no years or 3+ years — assume strong
      result[key] = "strong";
    }
  }
  return result;
}
