import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";

export const load: PageServerLoad = async ({ params, parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const id = parseInt(params.id);
  if (isNaN(id)) {
    redirect(302, "/dashboard/profile/education");
  }

  const education = await db.education.findFirst({
    where: { id, profile: layoutData.selectedProfile.id },
  });

  if (!education) {
    redirect(302, "/dashboard/profile/education");
  }

  // Get logo URL
  const logoUrl = education?.logo_path
    ? `/uploads/${education.logo_path}`
    : null;

  // Get banner URL
  const bannerUrl = education?.banner_path
    ? `/uploads/${education.banner_path}`
    : null;

  return { education, logoUrl, bannerUrl };
};
