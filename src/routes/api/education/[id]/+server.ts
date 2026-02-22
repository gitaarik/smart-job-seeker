import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) {
    error(401, "Not authenticated");
  }

  const educationId = parseInt(params.id, 10);
  if (isNaN(educationId)) {
    error(400, "Invalid education ID");
  }

  // Verify ownership through profile
  const education = await db.education.findFirst({
    where: { id: educationId },
    select: {
      id: true,
      profiles: {
        select: { user_id: true },
      },
    },
  });

  if (!education || education.profiles.user_id !== user.id) {
    error(403, "Access denied");
  }

  const data = await request.json();

  const updateData: Record<string, unknown> = {
    date_updated: new Date(),
  };

  const allowedFields = [
    "institution",
    "area",
    "study_type",
    "location",
    "url",
    "graduation_year",
    "start_date",
    "end_date",
    "summary",
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      if (field === "start_date" || field === "end_date") {
        updateData[field] = data[field] ? new Date(data[field] as string) : null;
      } else if (field === "graduation_year") {
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
  if (data.institution !== undefined && (!data.institution || (data.institution as string).trim().length === 0)) {
    error(400, "Institution is required");
  }

  await db.education.update({
    where: { id: educationId },
    data: updateData,
  });

  return json({ success: true });
};
