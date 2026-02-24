import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  // Get saved job matches
  const savedJobs = await db.job_matches.findMany({
    where: {
      profile: layoutData.selectedProfile.id,
      status: "saved",
    },
    include: {
      jobs: {
        include: {
          job_platforms: true,
        },
      },
    },
    orderBy: { date_updated: "desc" },
  });

  return {
    savedJobs,
    profileId: layoutData.selectedProfile.id,
  };
};

export const actions: Actions = {
  unsaveJob: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const jobId = parseInt(formData.get("jobId") as string);

    if (isNaN(jobId)) {
      return fail(400, { error: "Invalid job ID" });
    }

    // Find the match
    const match = await db.job_matches.findFirst({
      where: { profile: profileId, job: jobId },
    });

    if (!match) {
      return fail(404, { error: "Job match not found" });
    }

    // If the match has AI scoring data, just update status to "new"
    // If it was manually saved (score=0), delete it
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

    return { success: true, action: "unsaved", jobId };
  },

  // Also support re-saving from this page (for undo)
  saveJob: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const jobId = parseInt(formData.get("jobId") as string);

    if (isNaN(jobId)) {
      return fail(400, { error: "Invalid job ID" });
    }

    const match = await db.job_matches.findFirst({
      where: { profile: profileId, job: jobId },
    });

    if (match) {
      await db.job_matches.update({
        where: { id: match.id },
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

    return { success: true, action: "saved", jobId };
  },
};
