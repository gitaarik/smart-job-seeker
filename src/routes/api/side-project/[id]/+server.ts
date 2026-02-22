import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) {
    error(401, "Not authenticated");
  }

  const projectId = parseInt(params.id, 10);
  if (isNaN(projectId)) {
    error(400, "Invalid project ID");
  }

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
  const updateData: Record<string, unknown> = {
    date_updated: new Date(),
  };

  const allowedFields = [
    "name",
    "url",
    "url_label",
    "summary",
    "stars",
    "start_date",
    "end_date",
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      if (field === "start_date" || field === "end_date") {
        updateData[field] = data[field] ? new Date(data[field] as string) : null;
      } else if (field === "stars") {
        updateData[field] = data[field] ? parseInt(data[field] as string, 10) : null;
      } else {
        updateData[field] =
          typeof data[field] === "string"
            ? data[field].trim() || null
            : data[field];
      }
    }
  }

  // Validate required fields if provided
  if (data.name !== undefined && (!data.name || (data.name as string).trim().length === 0)) {
    error(400, "Project name is required");
  }

  await db.side_projects.update({
    where: { id },
    data: updateData,
  });

  return json({ success: true });
}

async function updateTechnologies(id: number, technologies: string[]) {
  // Delete existing technologies
  await db.side_project_technologies.deleteMany({
    where: { side_project: id },
  });

  // Create new technologies
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
  // Delete existing achievements
  await db.side_project_achievements.deleteMany({
    where: { side_project: id },
  });

  // Create new achievements
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
