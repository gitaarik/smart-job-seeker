import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";

export const load: PageServerLoad = async ({ params, parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const jobSearchId = parseInt(params.id);
  if (isNaN(jobSearchId)) {
    throw error(400, "Invalid job search ID");
  }

  const jobSearch = await db.job_searches.findFirst({
    where: {
      id: jobSearchId,
      profile: layoutData.selectedProfile.id,
    },
    include: {
      job_platforms: true,
    },
  });

  if (!jobSearch) {
    throw error(404, "Job search not found");
  }

  // Check if user is staff or admin for browser-use logs access
  const user = layoutData.user;
  const isStaff = (user as { is_staff?: boolean })?.is_staff || (user as { is_admin?: boolean })?.is_admin || false;

  return {
    jobSearch,
    isStaff,
  };
};
