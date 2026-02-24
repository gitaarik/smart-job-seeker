import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";

export const load: PageServerLoad = async ({ parent, url }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const status = url.searchParams.get("status") || "all";

  const where: { profile: number; status?: string } = {
    profile: layoutData.selectedProfile.id,
  };

  if (status !== "all") {
    where.status = status;
  }

  const jobMatches = await db.job_matches.findMany({
    where,
    include: {
      jobs: {
        include: {
          job_platforms: true,
        },
      },
    },
    orderBy: { score: "desc" },
  });

  return {
    jobMatches,
    currentStatus: status,
    profileId: layoutData.selectedProfile.id,
  };
};

export const actions: Actions = {
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

    // Find the match for this job
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
      // Create new match with saved status (no AI scoring)
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

    if (match) {
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
    }

    return { success: true, action: "unsaved", jobId };
  },
};
