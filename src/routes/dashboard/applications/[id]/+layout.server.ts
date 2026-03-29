import type { LayoutServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";

export const load: LayoutServerLoad = async ({ parent, params }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const appId = parseInt(params.id);
  if (isNaN(appId)) {
    error(400, "Invalid application ID");
  }

  const application = await db.applications.findFirst({
    where: {
      id: appId,
      profile: layoutData.selectedProfile.id,
    },
    include: {
      jobs: {
        include: {
          job_platforms: {
            select: { id: true, name: true, url: true },
          },
        },
      },
      application_letters: {
        orderBy: { date_created: "desc" },
      },
      application_questions: {
        orderBy: { sort: "asc" },
      },
      application_activity_log: {
        orderBy: { date: "desc" },
      },
      application_status_log: {
        orderBy: { date_created: "desc" },
      },
      applications_files: {
        include: {
          directus_files: {
            select: {
              id: true,
              filename_download: true,
              type: true,
              filesize: true,
              title: true,
            },
          },
        },
      },
      directus_files: {
        select: {
          id: true,
          filename_download: true,
          type: true,
          filesize: true,
          title: true,
        },
      },
    },
  });

  if (!application) {
    error(404, "Application not found");
  }

  return {
    application,
    profileId: layoutData.selectedProfile.id,
  };
};
