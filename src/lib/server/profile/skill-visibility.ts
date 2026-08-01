/**
 * What the profile knows about each of its skills, keyed by name — enough for a
 * job page to say "you have this, it's just not on your CV" and to let the
 * applicant change that without leaving the job.
 *
 * This is presentation state, deliberately kept out of the matcher: scoring
 * reads `tech_skills` wholesale and must stay blind to visibility. Keyed by
 * lowercased name because that is the only join a job's skill strings offer —
 * they are free text from a listing, not references.
 */

import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { tech_skill_categories, tech_skills } from "$lib/server/db/schema";
import {
  isProfileOnly,
  type ProfileSkillRef,
  versionsOf,
} from "$lib/profile-visibility";

export type { ProfileSkillRef };

/** Lowercased skill name → what the profile holds for it. */
export async function getProfileSkillIndex(
  profileId: number,
): Promise<Record<string, ProfileSkillRef>> {
  const rows = await db
    .select({
      id: tech_skills.id,
      name: tech_skills.name,
      level: tech_skills.level,
      categoryId: tech_skills.category_id,
      tags: tech_skills.tags,
    })
    .from(tech_skills)
    .innerJoin(
      tech_skill_categories,
      eq(tech_skills.category_id, tech_skill_categories.id),
    )
    .where(eq(tech_skill_categories.profile_id, profileId));

  const result: Record<string, ProfileSkillRef> = {};
  for (const row of rows) {
    const key = row.name?.trim().toLowerCase();
    // First one wins, matching how the rest of the app resolves a duplicate.
    if (!key || result[key]) continue;
    const tags = row.tags as string[] | null;
    result[key] = {
      id: row.id,
      name: row.name!,
      level: row.level,
      categoryId: row.categoryId!,
      profileOnly: isProfileOnly(tags),
      versions: versionsOf(tags),
    };
  }
  return result;
}
