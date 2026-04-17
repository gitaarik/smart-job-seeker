import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
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
  const workExperience = await db.work_experiences.findFirst({
    where: { id: workExperienceId },
    select: {
      id: true,
      profiles: {
        select: { user_id: true },
      },
    },
  });

  if (!workExperience || workExperience.profiles.user_id !== user.id) {
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

  await db.work_experiences.update({
    where: { id },
    data: updateData,
  });

  return json({ success: true });
}

async function updateTechnologies(id: number, technologies: string[]) {
  await db.work_experience_technologies.deleteMany({
    where: { work_experience_id: id },
  });

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
    await db.work_experience_technologies.createMany({ data: techData });
  }

  return json({ success: true });
}

async function updateAchievements(id: number, achievements: { description: string; tags?: string[] | null }[]) {
  await db.work_experience_achievements.deleteMany({
    where: { work_experience_id: id },
  });

  const now = new Date();
  const filtered = achievements
    .filter((a) => a.description?.trim())
    .map((a, i) => ({
      description: a.description.trim(),
      tags: a.tags,
      sort: i,
    }));

  if (filtered.length > 0) {
    await db.work_experience_achievements.createMany({
      data: filtered.map((a) => ({
        title: null,
        description: a.description,
        ...(a.tags && a.tags.length > 0 ? { tags: a.tags } : {}),
        work_experience_id: id,
        sort: a.sort,
        status: "published",
        date_created: now,
      })),
    });
  }

  return json({ success: true });
}
