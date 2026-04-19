import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { side_projects, side_project_technologies, side_project_achievements } from "$lib/server/db/schema";
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
  const project = await db.query.side_projects.findFirst({
    where: eq(side_projects.id, projectId),
    columns: {
      id: true,
    },
    with: {
      profile: {
        columns: { user_id: true },
      },
    },
  });

  if (!project || project.profile.user_id !== user.id) {
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
    ["name", "url", "url_label", "summary", "stars", "start_date", "end_date", "tags"],
    { start_date: "date", end_date: "date", stars: "number" },
  );

  await db.update(side_projects).set(updateData).where(eq(side_projects.id, id));

  return json({ success: true });
}

async function updateTechnologies(id: number, technologies: string[]) {
  await db.delete(side_project_technologies).where(
    eq(side_project_technologies.side_project_id, id),
  );

  const now = new Date();
  const techData = technologies
    .map((tech, i) => ({ name: tech?.trim(), sort: i }))
    .filter((t): t is { name: string; sort: number } => !!t.name)
    .map((t) => ({
      name: t.name,
      side_project_id: id,
      sort: t.sort,
      date_created: now,
    }));

  if (techData.length > 0) {
    await db.insert(side_project_technologies).values(techData);
  }

  return json({ success: true });
}

async function updateAchievements(id: number, achievements: string[]) {
  await db.delete(side_project_achievements).where(
    eq(side_project_achievements.side_project_id, id),
  );

  const achievementData = achievements
    .map((desc, i) => ({ description: desc?.trim(), sort: i }))
    .filter((a): a is { description: string; sort: number } => !!a.description)
    .map((a) => ({
      description: a.description,
      side_project_id: id,
      sort: a.sort,
    }));

  if (achievementData.length > 0) {
    await db.insert(side_project_achievements).values(achievementData);
  }

  return json({ success: true });
}
