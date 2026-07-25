import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  profile_document_projects,
  side_project_achievements,
  side_project_technologies,
  side_projects,
} from "$lib/server/db/schema";

export const load: PageServerLoad = async ({ params, parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }

  const id = parseInt(params.id);
  if (isNaN(id)) {
    redirect(302, "/profile/side-projects");
  }

  const project = await db.query.side_projects.findFirst({
    where: and(
      eq(side_projects.id, id),
      eq(side_projects.profile_id, layoutData.selectedProfile.id),
    ),
    with: {
      side_project_achievements: {
        orderBy: asc(side_project_achievements.sort),
      },
      side_project_technologies: {
        orderBy: asc(side_project_technologies.sort),
      },
    },
  });

  if (!project) {
    redirect(302, "/profile/side-projects");
  }

  // Documents attached to this side project.
  const documents = await db.query.profile_document_projects.findMany({
    where: eq(profile_document_projects.side_project_id, id),
    orderBy: [
      asc(profile_document_projects.sort),
      desc(profile_document_projects.date_created),
    ],
    columns: {
      id: true,
      kind: true,
      title: true,
      original_filename: true,
      status: true,
      summary: true,
      keywords: true,
      skipped: true,
      file_count: true,
      total_bytes: true,
    },
  });

  // Get image URL
  const imageUrl = project?.image_path
    ? `/uploads/${project.image_path}`
    : null;

  // Get banner URL
  const bannerUrl = project?.banner_path
    ? `/uploads/${project.banner_path}`
    : null;

  return {
    project,
    documents,
    profileId: layoutData.selectedProfile.id,
    imageUrl,
    bannerUrl,
  };
};
