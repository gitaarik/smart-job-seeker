import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../utils";
import { deleteEntityMedia } from "$lib/server/uploads/entity-media";

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

export const actions: Actions = {
  update: async ({ request, params, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return fail(400, { error: "Invalid education ID" });
    }

    // Verify ownership
    const existing = await db.education.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Education entry not found" });
    }

    const formData = await request.formData();
    const institution = formData.get("institution") as string;
    const area = formData.get("area") as string;
    const study_type = formData.get("study_type") as string;
    const location = formData.get("location") as string;
    const url = formData.get("url") as string;
    const graduation_year = formData.get("graduation_year") as string;
    const start_date = formData.get("start_date") as string;
    const end_date = formData.get("end_date") as string;
    const summary = formData.get("summary") as string;
    const deleteLogoPath = formData.get("delete_logo_path") as string;
    const deleteBannerPath = formData.get("delete_banner_path") as string;

    if (!institution || institution.trim().length === 0) {
      return fail(400, { error: "Institution is required" });
    }

    // Handle logo deletion if marked
    if (deleteLogoPath === "true") {
      await deleteEntityMedia("education", id, "logo_path");
    }

    // Handle banner deletion if marked
    if (deleteBannerPath === "true") {
      await deleteEntityMedia("education", id, "banner_path");
    }

    await db.education.update({
      where: { id },
      data: {
        institution: institution.trim(),
        area: area?.trim() || null,
        study_type: study_type?.trim() || null,
        location: location?.trim() || null,
        url: url?.trim() || null,
        graduation_year: graduation_year ? parseInt(graduation_year) : null,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        summary: summary?.trim() || null,
        date_updated: new Date(),
      },
    });

    return { success: true };
  },
};
