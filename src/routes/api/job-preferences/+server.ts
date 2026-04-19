import { json, type RequestHandler } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth } from "$lib/server/utils/api-helpers";
import { jobPreferencesPatchSchema, jobPreferencesSchema, parseBody } from "$lib/server/validation/api-schemas";

export const PUT: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);

  const { profile_id, job_types, experience_levels, work_location, locations, remote_only, match_community_jobs, community_max_age_days } =
    parseBody(jobPreferencesSchema, await request.json());

  // Verify the profile belongs to this user
  const profile = await db.query.profiles.findFirst({
    where: { id: profile_id, user_id: user.id },
  });

  if (!profile) {
    return json({ error: "Profile not found" }, { status: 404 });
  }

  // Check if config already exists
  const existing = await db.query.match_config.findFirst({
    where: { profile_id: profile_id },
  });

  const data = {
    job_types: job_types,
    experience_levels:
      experience_levels && experience_levels.length > 0
        ? experience_levels
        : null,
    work_location: work_location,
    locations: locations && locations.length > 0 ? locations : null,
    ...(remote_only !== undefined && { remote_only }),
    ...(match_community_jobs !== undefined && { match_community_jobs }),
    ...(community_max_age_days !== undefined && { community_max_age_days }),
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
        profile_id: profile_id,
        date_created: new Date(),
      },
    });
  }

  return json({ success: true, id: result.id });
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);

  const { profile_id, ...fields } = parseBody(
    jobPreferencesPatchSchema,
    await request.json(),
  );

  // Verify the profile belongs to this user
  const profile = await db.query.profiles.findFirst({
    where: { id: profile_id, user_id: user.id },
  });

  if (!profile) {
    return json({ error: "Profile not found" }, { status: 404 });
  }

  const existing = await db.query.match_config.findFirst({
    where: { profile_id: profile_id },
  });

  if (!existing) {
    return json(
      { error: "No match config found. Create one first via PUT." },
      { status: 404 },
    );
  }

  // Build update data from provided fields
  const data: Record<string, unknown> = { date_updated: new Date() };
  if (fields.job_types !== undefined) data.job_types = fields.job_types;
  if (fields.experience_levels !== undefined) {
    data.experience_levels =
      fields.experience_levels && fields.experience_levels.length > 0
        ? fields.experience_levels
        : null;
  }
  if (fields.work_location !== undefined)
    data.work_location = fields.work_location;
  if (fields.locations !== undefined) {
    data.locations =
      fields.locations && fields.locations.length > 0
        ? fields.locations
        : null;
  }
  if (fields.remote_only !== undefined)
    data.remote_only = fields.remote_only;
  if (fields.match_community_jobs !== undefined)
    data.match_community_jobs = fields.match_community_jobs;
  if (fields.community_max_age_days !== undefined)
    data.community_max_age_days = fields.community_max_age_days;

  const result = await db.match_config.update({
    where: { id: existing.id },
    data,
  });

  return json({ success: true, id: result.id });
};
