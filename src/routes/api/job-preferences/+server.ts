import { json, type RequestHandler } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";

export const PUT: RequestHandler = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { profile_id, job_types, experience_levels, remote_options, locations } = body;

  if (!profile_id) {
    return json({ error: "No profile specified" }, { status: 400 });
  }

  // Verify the profile belongs to this user
  const profile = await db.profiles.findFirst({
    where: { id: profile_id, user_id: user.id },
  });

  if (!profile) {
    return json({ error: "Profile not found" }, { status: 404 });
  }

  const profileId = profile_id;

  // Validate required fields
  if (!job_types || !Array.isArray(job_types) || job_types.length === 0) {
    return json(
      { error: "Please select at least one job type" },
      { status: 400 }
    );
  }

  if (
    !remote_options ||
    !Array.isArray(remote_options) ||
    remote_options.length === 0
  ) {
    return json(
      { error: "Please select at least one work location option" },
      { status: 400 }
    );
  }

  // Check if preferences already exist
  const existing = await db.job_match_preferences.findFirst({
    where: { profile: profileId },
  });

  const data = {
    job_types: job_types,
    experience_levels:
      experience_levels && experience_levels.length > 0
        ? experience_levels
        : null,
    remote_options: remote_options,
    locations: locations && locations.length > 0 ? locations : null,
    date_updated: new Date(),
  };

  let result;
  if (existing) {
    result = await db.job_match_preferences.update({
      where: { id: existing.id },
      data,
    });
  } else {
    result = await db.job_match_preferences.create({
      data: {
        ...data,
        profile: profileId,
        date_created: new Date(),
      },
    });
  }

  return json({ success: true, id: result.id });
};
