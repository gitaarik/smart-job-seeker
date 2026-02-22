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
  updateStatus: async ({ request, locals, cookies }) => {
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
    const status = formData.get("status") as string;

    if (isNaN(id)) {
      return fail(400, { error: "Invalid match ID" });
    }

    const existing = await db.job_matches.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Job match not found" });
    }

    await db.job_matches.update({
      where: { id },
      data: {
        status,
        date_updated: new Date(),
      },
    });

    return { success: true };
  },
};
