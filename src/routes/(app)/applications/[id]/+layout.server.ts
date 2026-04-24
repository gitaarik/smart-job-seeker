import type { LayoutServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { applications, application_letters, application_questions, application_activity_log, application_status_log, letter_versions } from "$lib/server/db/schema";

export const load: LayoutServerLoad = async ({ parent, params }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }

  const appId = parseInt(params.id);
  if (isNaN(appId)) {
    error(400, "Invalid application ID");
  }

  const application = await db.query.applications.findFirst({
    where: and(eq(applications.id, appId), eq(applications.profile_id, layoutData.selectedProfile.id)),
    with: {
      job: {
        with: {
          job_platform: {
            columns: { id: true, name: true, url: true },
          },
        },
      },
      application_letters: {
        orderBy: desc(application_letters.date_created),
        with: {
          letter_versions: {
            orderBy: asc(letter_versions.id),
            columns: { id: true, source: true, content: true },
          },
        },
      },
      application_questions: {
        orderBy: asc(application_questions.sort),
      },
      application_activity_logs: {
        orderBy: desc(application_activity_log.date),
      },
      application_status_logs: {
        orderBy: desc(application_status_log.date_created),
      },
      applications_files: {
        with: {
          file: {
            columns: {
              id: true,
              filename_download: true,
              type: true,
              filesize: true,
              title: true,
            },
          },
        },
      },
      file: {
        columns: {
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
