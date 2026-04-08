import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const education = await db.education.findMany({
    where: { profile: layoutData.selectedProfile.id },
    orderBy: { sort: "asc" },
  });

  return { education, profileId: layoutData.selectedProfile.id };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
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

    if (!institution || institution.trim().length === 0) {
      return fail(400, { error: "Institution is required" });
    }

    // Get the highest sort value
    const lastItem = await db.education.findFirst({
      where: { profile: profileId },
      orderBy: { sort: "desc" },
    });

    const created = await db.education.create({
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
        profile: profileId,
        sort: (lastItem?.sort ?? -1) + 1,
        status: "published",
        date_created: new Date(),
      },
    });

    // Redirect to edit page for the new education entry
    redirect(302, `/dashboard/profile/education/${created.id}`);
  },

  delete: async ({ request, locals, cookies }) => {
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
      return fail(400, { error: "Invalid education ID" });
    }

    // Verify ownership
    const existing = await db.education.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Education entry not found" });
    }

    await db.education.delete({
      where: { id },
    });

    return { success: true };
  },
};
