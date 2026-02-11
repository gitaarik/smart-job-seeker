import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard/profile");
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
  unsave: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);

    if (isNaN(id)) {
      return fail(400, { error: "Invalid match ID" });
    }

    const existing = await db.job_matches.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Job match not found" });
    }

    // Set status back to "viewed"
    await db.job_matches.update({
      where: { id },
      data: {
        status: "viewed",
        date_updated: new Date(),
      },
    });

    return { success: true };
  },
};
