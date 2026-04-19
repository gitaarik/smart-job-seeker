import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
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
    ["name", "position", "location", "website", "summary", "start_date", "end_date", "tags"],
    { start_date: "date", end_date: "date" },
  );

  await db.update(work_experiences).set(updateData).where(eq(work_experiences.id, id));

  return json({ success: true });
}

async function updateTechnologies(id: number, technologies: string[]) {
  await db.delete(work_experience_technologies).where(
    eq(work_experience_technologies.work_experience_id, id),
  );

  const now = new Date();
  const techData = technologies
    .map((tech, i) => ({ name: tech?.trim(), sort: i }))
    .filter((t): t is { name: string; sort: number } => !!t.name)
    .map((t) => ({
      name: t.name,
      work_experience_id: id,
      sort: t.sort,
      status: "published",
      date_created: now,
    }));

  if (techData.length > 0) {
    await db.insert(work_experience_technologies).values(techData);
  }

  return json({ success: true });
}

async function updateAchievements(id: number, achievements: { description: string; tags?: string[] | null }[]) {
  await db.delete(work_experience_achievements).where(
    eq(work_experience_achievements.work_experience_id, id),
  );

  const now = new Date();
  const filtered = achievements
    .filter((a) => a.description?.trim())
    .map((a, i) => ({
      description: a.description.trim(),
      tags: a.tags,
      sort: i,
    }));

  if (filtered.length > 0) {
    await db.insert(work_experience_achievements).values(
      filtered.map((a) => ({
        description: a.description,
        ...(a.tags && a.tags.length > 0 ? { tags: a.tags } : {}),
        work_experience_id: id,
        sort: a.sort,
        status: "published",
        date_created: now,
      })),
    );
  }

  return json({ success: true });
}
