import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getProfileSkillLevels } from "$lib/server/job/match-utils";
import { calculateMatch, getMatchingConfig, upsertJobMatch } from "$lib/server/job/matcher";
import { getSelectedProfileId } from "../../profile/utils";

export const load: PageServerLoad = async ({ parent, params }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const profileId = layoutData.selectedProfile.id;
  const jobId = parseInt(params.id);

  if (isNaN(jobId)) {
    error(400, "Invalid job ID");
  }

  // Get job with platform info
  const job = await db.jobs.findUnique({
    where: { id: jobId },
    include: {
      job_platforms: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!job) {
    error(404, "Job not found");
  }

  // Get match info if exists
  const match = await db.job_matches.findFirst({
    where: {
      profile: profileId,
      job: jobId,
    },
  });

  // Determine job category for sidebar highlighting
  const jobCategory = match?.status === "saved" ? "saved" : match && match.score > 0 ? "matches" : "all";

  // Load user's skill proficiency levels for highlighting
  const profileSkillLevels = await getProfileSkillLevels(profileId);

  // Check staff status
  const user = layoutData.user;
  const isStaff = !!(user as { is_staff?: boolean })?.is_staff || !!(user as { is_admin?: boolean })?.is_admin;

  return {
    job,
    match,
    profileId,
    jobCategory,
    profileSkillLevels,
    isStaff,
  };
};

export const actions: Actions = {
  saveJob: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const jobId = parseInt(params.id);
    if (isNaN(jobId)) {
      return fail(400, { error: "Invalid job ID" });
    }

    // Check if job exists
    const job = await db.jobs.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return fail(404, { error: "Job not found" });
    }

    // Check if match already exists
    const existingMatch = await db.job_matches.findFirst({
      where: { profile: profileId, job: jobId },
    });

    if (existingMatch) {
      await db.job_matches.update({
        where: { id: existingMatch.id },
        data: {
          status: "saved",
          date_updated: new Date(),
        },
      });
    } else {
      await db.job_matches.create({
        data: {
          profile: profileId,
          job: jobId,
          status: "saved",
          score: 0,
          date_created: new Date(),
          date_updated: new Date(),
        },
      });
    }

    return { success: true, action: "saved" };
  },

  unsaveJob: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const jobId = parseInt(params.id);
    if (isNaN(jobId)) {
      return fail(400, { error: "Invalid job ID" });
    }

    const match = await db.job_matches.findFirst({
      where: { profile: profileId, job: jobId },
    });

    if (match) {
      if (match.score === 0 && !match.reasoning) {
        await db.job_matches.delete({
          where: { id: match.id },
        });
      } else {
        await db.job_matches.update({
          where: { id: match.id },
          data: {
            status: "new",
            date_updated: new Date(),
          },
        });
      }
    }

    return { success: true, action: "unsaved" };
  },

  updateStatus: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const jobId = parseInt(params.id);
    if (isNaN(jobId)) {
      return fail(400, { error: "Invalid job ID" });
    }

    const formData = await request.formData();
    const status = formData.get("status") as string;

    const match = await db.job_matches.findFirst({
      where: { profile: profileId, job: jobId },
    });

    if (!match) {
      return fail(404, { error: "Job match not found" });
    }

    await db.job_matches.update({
      where: { id: match.id },
      data: {
        status,
        date_updated: new Date(),
      },
    });

    return { success: true, status };
  },

  rematchJob: async ({ locals, cookies, params }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    // Staff-only action
    const isStaff = !!(user as { is_staff?: boolean }).is_staff || !!(user as { is_admin?: boolean }).is_admin;
    if (!isStaff) {
      return fail(403, { error: "Staff access required" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const jobId = parseInt(params.id);
    if (isNaN(jobId)) {
      return fail(400, { error: "Invalid job ID" });
    }

    const job = await db.jobs.findUnique({ where: { id: jobId } });
    if (!job) {
      return fail(404, { error: "Job not found" });
    }

    const config = await getMatchingConfig(profileId);
    if (!config) {
      return fail(400, { error: "No matching config found for profile" });
    }

    try {
      const matchResult = await calculateMatch(profileId, job, config);
      await upsertJobMatch(matchResult);
      return { success: true, action: "rematched" };
    } catch (err) {
      return fail(500, {
        error: `Re-match failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  },
};
