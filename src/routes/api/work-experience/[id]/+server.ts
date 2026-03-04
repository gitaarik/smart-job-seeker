import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam, buildUpdateData } from "$lib/server/utils/api-helpers";

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

  const data = await request.json();

  // Handle different section updates
  if (data.section === "basic") {
    return updateBasicInfo(workExperienceId, data);
  } else if (data.section === "technologies") {
    return updateTechnologies(workExperienceId, data.technologies);
  } else if (data.section === "achievements") {
    return updateAchievements(workExperienceId, data.achievements);
  }

  // Default: update basic fields
  return updateBasicInfo(workExperienceId, data);
};

async function updateBasicInfo(id: number, data: Record<string, unknown>) {
  // Validate required fields if provided
  if (data.name !== undefined && (!data.name || (data.name as string).trim().length === 0)) {
    error(400, "Company name is required");
  }
  if (data.position !== undefined && (!data.position || (data.position as string).trim().length === 0)) {
    error(400, "Position is required");
  }

  const updateData = buildUpdateData(
    data,
    ["name", "position", "location", "website", "summary", "start_date", "end_date"],
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
    where: { work_experience: id },
  });

  for (let i = 0; i < technologies.length; i++) {
    const techName = technologies[i]?.trim();
    if (techName) {
      await db.work_experience_technologies.create({
        data: {
          name: techName,
          work_experience: id,
          sort: i,
          status: "published",
          date_created: new Date(),
        },
      });
    }
  }

  return json({ success: true });
}

async function updateAchievements(id: number, achievements: string[]) {
  await db.work_experience_achievements.deleteMany({
    where: { work_experience: id },
  });

  for (let i = 0; i < achievements.length; i++) {
    const description = achievements[i];
    if (description?.trim()) {
      await db.work_experience_achievements.create({
        data: {
          title: null,
          description: description.trim(),
          work_experience: id,
          sort: i,
          status: "published",
          date_created: new Date(),
        },
      });
    }
  }

  return json({ success: true });
}
