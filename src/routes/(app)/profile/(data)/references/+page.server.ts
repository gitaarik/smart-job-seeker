import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { references } from "$lib/server/db/schema";
import { getSelectedProfileId, touchProfile } from "../../utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }

  const items = await db.query.references.findMany({
    where: eq(references.profile_id, layoutData.selectedProfile.id),
    orderBy: asc(references.sort),
  });

  return { references: items, profileId: layoutData.selectedProfile.id };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const author = formData.get("author") as string;
    const author_position = formData.get("author_position") as string;
    const text = formData.get("text") as string;

    if (!author || author.trim().length === 0) return fail(400, { error: "Author name is required" });

    const lastItem = await db.query.references.findFirst({
      where: eq(references.profile_id, profileId),
      orderBy: desc(references.sort),
    });

    await db.insert(references).values({
      author: author.trim(),
      author_position: author_position?.trim() || null,
      text: text?.trim() || null,
      profile_id: profileId,
      sort: (lastItem?.sort ?? -1) + 1,
      status: "published",
      date_created: new Date(),
    });

    await touchProfile(profileId);
    return { success: true };
  },

  update: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const author = formData.get("author") as string;
    const author_position = formData.get("author_position") as string;
    const text = formData.get("text") as string;

    if (isNaN(id)) return fail(400, { error: "Invalid reference ID" });
    if (!author || author.trim().length === 0) return fail(400, { error: "Author name is required" });

    const existing = await db.query.references.findFirst({
      where: and(eq(references.id, id), eq(references.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Reference not found" });

    await db.update(references).set({
      author: author.trim(),
      author_position: author_position?.trim() || null,
      text: text?.trim() || null,
      date_updated: new Date(),
    }).where(eq(references.id, id));

    await touchProfile(profileId);
    return { success: true };
  },

  delete: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid reference ID" });

    const existing = await db.query.references.findFirst({
      where: and(eq(references.id, id), eq(references.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Reference not found" });

    await db.delete(references).where(eq(references.id, id));

    await touchProfile(profileId);
    return { success: true };
  },
};
