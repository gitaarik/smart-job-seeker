import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, eq, notInArray } from "drizzle-orm";
import { work_experiences, work_experience_technologies, work_experience_achievements } from "$lib/server/db/schema";
import { requireAuth, parseIntParam, buildUpdateData } from "$lib/server/utils/api-helpers";
import {
  workExperienceBasicSchema,
  workExperienceTechSchema,
  workExperienceAchievementsSchema,
  parseBody,
} from "$lib/server/validation/api-schemas";

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  const workExperienceId = parseIntParam(params.id, "work experience");

  // Verify ownership through profile
  const workExperience = await db.query.work_experiences.findFirst({
    where: eq(work_experiences.id, workExperienceId),
    columns: {
      id: true,
    },
    with: {
      profile: {
        columns: { user_id: true },
      },
    },
  });

  if (!workExperience || workExperience.profile.user_id !== user.id) {
    error(403, "Access denied");
  }

  const raw = await request.json();

  if (raw.section === "technologies") {
    const data = parseBody(workExperienceTechSchema, raw);
    return updateTechnologies(workExperienceId, data.technologies);
  } else if (raw.section === "achievements") {
    const data = parseBody(workExperienceAchievementsSchema, raw);
    return updateAchievements(workExperienceId, data.achievements);
  }

  const data = parseBody(workExperienceBasicSchema, raw);
  return updateBasicInfo(workExperienceId, data);
};

async function updateBasicInfo(id: number, data: Record<string, unknown>) {
  const updateData = buildUpdateData(
    data,
    ["name", "position", "location", "website", "headline", "summary", "start_date", "end_date", "tags"],
    { start_date: "date", end_date: "date" },
  );

  await db.update(work_experiences).set(updateData).where(eq(work_experiences.id, id));

  return json({ success: true });
}

async function updateTechnologies(
  id: number,
  technologies: (string | { name: string; tags?: string[] | null })[],
) {
  await db.delete(work_experience_technologies).where(
    eq(work_experience_technologies.work_experience_id, id),
  );

  const now = new Date();
  const techData = technologies
    .map((tech, i) => {
      const name = (typeof tech === "string" ? tech : tech.name)?.trim();
      const tags = typeof tech === "string" ? null : (tech.tags ?? null);
      return { name, tags, sort: i };
    })
    .filter((t): t is { name: string; tags: string[] | null; sort: number } => !!t.name)
    .map((t) => ({
      name: t.name,
      work_experience_id: id,
      sort: t.sort,
      status: "published",
      date_created: now,
      ...(t.tags && t.tags.length > 0 ? { tags: t.tags } : {}),
    }));

  if (techData.length > 0) {
    await db.insert(work_experience_technologies).values(techData);
  }

  return json({ success: true });
}

async function updateAchievements(
  id: number,
  achievements: { id?: number; description: string; tags?: string[] | null }[],
) {
  const now = new Date();
  const incoming = achievements.filter((a) => a.description?.trim());

  // Delete rows the client no longer has; keep everything it still references
  // by id so their ids stay stable (translations are keyed on them).
  const keepIds = incoming
    .map((a) => a.id)
    .filter((x): x is number => Number.isInteger(x));
  await db.delete(work_experience_achievements).where(
    keepIds.length > 0
      ? and(
        eq(work_experience_achievements.work_experience_id, id),
        notInArray(work_experience_achievements.id, keepIds),
      )
      : eq(work_experience_achievements.work_experience_id, id),
  );

  // Update existing rows in place, insert new ones; return ids in order so the
  // client can adopt ids for freshly-added achievements.
  const result: { id: number }[] = [];
  for (let i = 0; i < incoming.length; i++) {
    const a = incoming[i];
    const description = a.description.trim();
    const tags = a.tags && a.tags.length > 0 ? a.tags : null;

    let row: { id: number } | undefined;
    if (Number.isInteger(a.id)) {
      [row] = await db
        .update(work_experience_achievements)
        .set({ description, tags, sort: i, date_updated: now })
        .where(and(
          eq(work_experience_achievements.id, a.id as number),
          eq(work_experience_achievements.work_experience_id, id),
        ))
        .returning({ id: work_experience_achievements.id });
    }
    // No id, or a stale id whose row is gone (e.g. deleted then undone) → insert.
    if (!row) {
      [row] = await db
        .insert(work_experience_achievements)
        .values({
          description,
          tags,
          work_experience_id: id,
          sort: i,
          status: "published",
          date_created: now,
        })
        .returning({ id: work_experience_achievements.id });
    }
    result.push({ id: row.id });
  }

  return json({ success: true, achievements: result });
}
