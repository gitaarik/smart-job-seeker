import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getProfileByIdentifier } from "$lib/server/profile/default";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard/profile");
  }

  const profile = await getProfileByIdentifier(layoutData.selectedProfile.id);

  if (!profile) {
    redirect(302, "/dashboard/profile");
  }

  return { profile };
};

export const actions: Actions = {
  update: async ({ request, locals, parent }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const layoutData = await parent();
    if (!layoutData.selectedProfile) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();

    // Basic info fields
    const name = formData.get("name") as string;
    const title = formData.get("title") as string;
    const subtitle = formData.get("subtitle") as string;
    const headline = formData.get("headline") as string;
    const summary = formData.get("summary") as string;

    // Contact fields
    const email_address = formData.get("email_address") as string;
    const phone_number = formData.get("phone_number") as string;
    const personal_website = formData.get("personal_website") as string;

    // Location fields
    const city = formData.get("city") as string;
    const region = formData.get("region") as string;
    const country_code = formData.get("country_code") as string;

    // Social profiles
    const linkedin_profile = formData.get("linkedin_profile") as string;
    const github_profile = formData.get("github_profile") as string;
    const stackoverflow_profile = formData.get(
      "stackoverflow_profile",
    ) as string;
    const npm_profile = formData.get("npm_profile") as string;
    const pypi_profile = formData.get("pypi_profile") as string;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Name is required" });
    }

    await db.profiles.update({
      where: { id: layoutData.selectedProfile.id },
      data: {
        name: name.trim(),
        title: title?.trim() || null,
        subtitle: subtitle?.trim() || null,
        headline: headline?.trim() || null,
        summary: summary?.trim() || null,
        email_address: email_address?.trim() || null,
        phone_number: phone_number?.trim() || null,
        personal_website: personal_website?.trim() || null,
        city: city?.trim() || null,
        region: region?.trim() || null,
        country_code: country_code?.trim() || null,
        linkedin_profile: linkedin_profile?.trim() || null,
        github_profile: github_profile?.trim() || null,
        stackoverflow_profile: stackoverflow_profile?.trim() || null,
        npm_profile: npm_profile?.trim() || null,
        pypi_profile: pypi_profile?.trim() || null,
        date_updated: new Date(),
      },
    });

    return { success: true };
  },
};
