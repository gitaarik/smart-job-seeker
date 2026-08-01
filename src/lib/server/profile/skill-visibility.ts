/**
 * Which of a profile's skills are profile-only — kept for matching but held
 * back from documents (see $lib/profile-visibility).
 *
 * This is presentation state, deliberately kept out of the matcher: scoring
 * reads `tech_skills` wholesale and must stay blind to visibility. It exists so
 * a job page can say "you have this, it's just not on your CV" instead of
 * letting a held-back skill quietly become invisible debt.
 */

import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { tech_skill_categories, tech_skills } from "$lib/server/db/schema";
import { isProfileOnly } from "$lib/profile-visibility";

/** Lowercased skill name → skill id, for the profile's profile-only skills. */
export async function getProfileOnlySkillIds(
  profileId: number,
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      id: tech_skills.id,
      name: tech_skills.name,
      tags: tech_skills.tags,
    })
    .from(tech_skills)
    .innerJoin(
      tech_skill_categories,
      eq(tech_skills.category_id, tech_skill_categories.id),
    )
    .where(eq(tech_skill_categories.profile_id, profileId));

  const result: Record<string, number> = {};
  for (const row of rows) {
    if (!row.name) continue;
    if (!isProfileOnly(row.tags as string[] | null)) continue;
    result[row.name.trim().toLowerCase()] = row.id;
  }
  return result;
}
