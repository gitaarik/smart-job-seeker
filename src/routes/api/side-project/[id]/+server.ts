import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, eq, notInArray } from "drizzle-orm";
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
    ["name", "url", "repo_url", "summary", "stars", "start_date", "end_date", "tags"],
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

async function updateAchievements(
  id: number,
  achievements: { id?: number; description: string }[],
) {
  const now = new Date();
  const incoming = achievements.filter((a) => a.description?.trim());

  // Keep rows still referenced by id (stable ids for translations); delete rest.
  const keepIds = incoming
    .map((a) => a.id)
    .filter((x): x is number => Number.isInteger(x));
  await db.delete(side_project_achievements).where(
    keepIds.length > 0
      ? and(
        eq(side_project_achievements.side_project_id, id),
        notInArray(side_project_achievements.id, keepIds),
      )
      : eq(side_project_achievements.side_project_id, id),
  );

  const result: { id: number }[] = [];
  for (let i = 0; i < incoming.length; i++) {
    const a = incoming[i];
    const description = a.description.trim();

    let row: { id: number } | undefined;
    if (Number.isInteger(a.id)) {
      [row] = await db
        .update(side_project_achievements)
        .set({ description, sort: i, date_updated: now })
        .where(and(
          eq(side_project_achievements.id, a.id as number),
          eq(side_project_achievements.side_project_id, id),
        ))
        .returning({ id: side_project_achievements.id });
    }
    if (!row) {
      [row] = await db
        .insert(side_project_achievements)
        .values({ description, side_project_id: id, sort: i, date_created: now })
        .returning({ id: side_project_achievements.id });
    }
    result.push({ id: row.id });
  }

  return json({ success: true, achievements: result });
}
