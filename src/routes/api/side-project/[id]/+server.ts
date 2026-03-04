import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam, buildUpdateData } from "$lib/server/utils/api-helpers";

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

  const data = await request.json();

  // Handle different section updates
  if (data.section === "basic") {
    return updateBasicInfo(projectId, data);
  } else if (data.section === "technologies") {
    return updateTechnologies(projectId, data.technologies);
  } else if (data.section === "achievements") {
    return updateAchievements(projectId, data.achievements);
  }

  // Default: update basic fields
  return updateBasicInfo(projectId, data);
};

async function updateBasicInfo(id: number, data: Record<string, unknown>) {
  // Validate required fields if provided
  if (data.name !== undefined && (!data.name || (data.name as string).trim().length === 0)) {
    error(400, "Project name is required");
  }

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

  for (let i = 0; i < technologies.length; i++) {
    const techName = technologies[i]?.trim();
    if (techName) {
      await db.side_project_technologies.create({
        data: {
          name: techName,
          side_project: id,
          sort: i,
          date_created: new Date(),
        },
      });
    }
  }

  return json({ success: true });
}

async function updateAchievements(id: number, achievements: string[]) {
  await db.side_project_achievements.deleteMany({
    where: { side_project: id },
  });

  for (let i = 0; i < achievements.length; i++) {
    const description = achievements[i]?.trim();
    if (description) {
      await db.side_project_achievements.create({
        data: {
          description,
          side_project: id,
          sort: i,
        },
      });
    }
  }

  return json({ success: true });
}
