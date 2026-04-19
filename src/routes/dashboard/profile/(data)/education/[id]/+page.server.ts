import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and } from "drizzle-orm";
import { education } from "$lib/server/db/schema";

export const load: PageServerLoad = async ({ params, parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const id = parseInt(params.id);
  if (isNaN(id)) {
    redirect(302, "/dashboard/profile/education");
  }

  const entry = await db.query.education.findFirst({
    where: and(eq(education.id, id), eq(education.profile_id, layoutData.selectedProfile.id)),
  });

  if (!entry) {
    redirect(302, "/dashboard/profile/education");
  }

  // Get logo URL
  const logoUrl = entry?.logo_path
    ? `/uploads/${entry.logo_path}`
    : null;

  // Get banner URL
  const bannerUrl = entry?.banner_path
    ? `/uploads/${entry.banner_path}`
    : null;

  return { education: entry, logoUrl, bannerUrl };
};
