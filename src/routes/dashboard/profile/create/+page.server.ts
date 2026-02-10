import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";

export const load: PageServerLoad = async ({ parent }) => {
  // Layout already handles auth
  await parent();
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const title = formData.get("title") as string;

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Name is required", name, title });
    }

    // Generate a slug from the name
    let slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Ensure slug is unique by appending a number if necessary
    let slugSuffix = 0;
    let finalSlug = slug;
    while (true) {
      const existing = await db.profiles.findFirst({
        where: { slug: finalSlug },
      });
      if (!existing) break;
      slugSuffix++;
      finalSlug = `${slug}-${slugSuffix}`;
    }

    // Create the profile
    const profile = await db.profiles.create({
      data: {
        name: name.trim(),
        title: title?.trim() || null,
        slug: finalSlug,
        user_id: user.id,
        is_default: false,
      },
    });

    // Redirect to dashboard with new profile selected
    redirect(302, `/dashboard?profile=${profile.id}`);
  },
};
