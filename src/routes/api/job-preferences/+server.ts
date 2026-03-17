import { json, type RequestHandler } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth } from "$lib/server/utils/api-helpers";
import { jobPreferencesSchema, parseBody } from "$lib/server/validation/api-schemas";

export const PUT: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);

  const { profile_id, job_types, experience_levels, work_location, locations } =
    parseBody(jobPreferencesSchema, await request.json());

  // Verify the profile belongs to this user
  const profile = await db.profiles.findFirst({
    where: { id: profile_id, user_id: user.id },
  });

  if (!profile) {
    return json({ error: "Profile not found" }, { status: 404 });
  }

  // Check if config already exists
  const existing = await db.match_config.findFirst({
    where: { profile: profile_id },
  });

  const data = {
    job_types: job_types,
    experience_levels:
      experience_levels && experience_levels.length > 0
        ? experience_levels
        : null,
    work_location: work_location,
    locations: locations && locations.length > 0 ? locations : null,
    date_updated: new Date(),
  };

  let result;
  if (existing) {
    result = await db.match_config.update({
      where: { id: existing.id },
      data,
    });
  } else {
    result = await db.match_config.create({
      data: {
        ...data,
        profile: profile_id,
        date_created: new Date(),
      },
    });
  }

  return json({ success: true, id: result.id });
};
