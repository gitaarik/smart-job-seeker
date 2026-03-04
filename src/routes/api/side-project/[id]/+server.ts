import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam, buildUpdateData } from "$lib/server/utils/api-helpers";
import {
  sideProjectBasicSchema,
  sideProjectTechSchema,
  sideProjectAchievementsSchema,
  parseBody,
} from "$lib/server/validation/api-schemas";

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  const projectId = parseIntParam(params.id, "project");

  // Verify ownership through profile
  const project = await db.side_projects.findFirst({
    where: { id: projectId },
    select: {
      id: true,
      profiles: {
        select: { user_id: true },
      },
    },
  });

  if (!project || project.profiles.user_id !== user.id) {
    error(403, "Access denied");
  }

  const raw = await request.json();

  if (raw.section === "technologies") {
    const data = parseBody(sideProjectTechSchema, raw);
    return updateTechnologies(projectId, data.technologies);
  } else if (raw.section === "achievements") {
    const data = parseBody(sideProjectAchievementsSchema, raw);
    return updateAchievements(projectId, data.achievements);
  }

  const data = parseBody(sideProjectBasicSchema, raw);
  return updateBasicInfo(projectId, data);
};

async function updateBasicInfo(id: number, data: Record<string, unknown>) {
  const updateData = buildUpdateData(
    data,
    ["name", "url", "url_label", "summary", "stars", "start_date", "end_date"],
    { start_date: "date", end_date: "date", stars: "number" },
  );

  await db.side_projects.update({
    where: { id },
    data: updateData,
  });

  return json({ success: true });
}

async function updateTechnologies(id: number, technologies: string[]) {
  await db.side_project_technologies.deleteMany({
    where: { side_project: id },
  });

  const now = new Date();
  const techData = technologies
    .map((tech, i) => ({ name: tech?.trim(), sort: i }))
    .filter((t): t is { name: string; sort: number } => !!t.name)
    .map((t) => ({
      name: t.name,
      side_project: id,
      sort: t.sort,
      date_created: now,
    }));

  if (techData.length > 0) {
    await db.side_project_technologies.createMany({ data: techData });
  }

  return json({ success: true });
}

async function updateAchievements(id: number, achievements: string[]) {
  await db.side_project_achievements.deleteMany({
    where: { side_project: id },
  });

  const achievementData = achievements
    .map((desc, i) => ({ description: desc?.trim(), sort: i }))
    .filter((a): a is { description: string; sort: number } => !!a.description)
    .map((a) => ({
      description: a.description,
      side_project: id,
      sort: a.sort,
    }));

  if (achievementData.length > 0) {
    await db.side_project_achievements.createMany({ data: achievementData });
  }

  return json({ success: true });
}
