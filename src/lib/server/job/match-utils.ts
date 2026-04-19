/**
 * Utility functions for job matching - profile skill extraction
 */

import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { tech_skills, tech_skill_categories } from "$lib/server/db/schema";

/**
 * Extract tech skills from a profile
 * @param profileId - Profile ID to extract skills from
 * @returns Array of skill names
 */
export async function getProfileSkills(profileId: number): Promise<string[]> {
  const rows = await db
    .select({ name: tech_skills.name })
    .from(tech_skills)
    .innerJoin(tech_skill_categories, eq(tech_skills.category_id, tech_skill_categories.id))
    .where(eq(tech_skill_categories.profile_id, profileId));

  return rows
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
  const rows = await db
    .select({
      name: tech_skills.name,
      level: tech_skills.level,
      years_experience: tech_skills.years_experience,
    })
    .from(tech_skills)
    .innerJoin(tech_skill_categories, eq(tech_skills.category_id, tech_skill_categories.id))
    .where(eq(tech_skill_categories.profile_id, profileId));

  const result: Record<string, "strong" | "weak"> = {};
  for (const skill of rows) {
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
