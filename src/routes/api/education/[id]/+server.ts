import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam, buildUpdateData } from "$lib/server/utils/api-helpers";
import { educationUpdateSchema, parseBody } from "$lib/server/validation/api-schemas";

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  const educationId = parseIntParam(params.id, "education");

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

  const data = parseBody(educationUpdateSchema, await request.json());

  const updateData = buildUpdateData(
    data,
    ["institution", "area", "study_type", "location", "url", "graduation_year", "start_date", "end_date", "summary"],
    { start_date: "date", end_date: "date", graduation_year: "number" },
  );

  await db.education.update({
    where: { id: educationId },
    data: updateData,
  });

  return json({ success: true });
};
