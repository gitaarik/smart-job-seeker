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

  const application = await db.query.applications.findFirst({
    where: {
      id: appId,
      profile_id: layoutData.selectedProfile.id,
    },
    with: {
      jobs: {
        with: {
          job_platforms: {
            select: { id: true, name: true, url: true },
          },
        },
      },
      application_letters: {
        orderBy: { date_created: "desc" },
        with: {
          letter_versions: {
            orderBy: { id: "asc" },
            select: { id: true, source: true, content: true },
          },
        },
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
        with: {
          files: {
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
      files: {
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
