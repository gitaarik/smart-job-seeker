import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { certificates } from "$lib/server/db/schema";
import { getSelectedProfileId } from "../../utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }

  const certs = await db.query.certificates.findMany({
    where: eq(certificates.profile_id, layoutData.selectedProfile.id),
    orderBy: asc(certificates.sort),
  });

  return { certificates: certs, profileId: layoutData.selectedProfile.id };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const issuer = formData.get("issuer") as string;
    const date = formData.get("date") as string;
    const url = formData.get("url") as string;

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Certificate name is required" });
    }

    const lastItem = await db.query.certificates.findFirst({
      where: eq(certificates.profile_id, profileId),
      orderBy: desc(certificates.sort),
    });

    await db.insert(certificates).values({
      name: name.trim(),
      issuer: issuer?.trim() || null,
      // certificates.date is Drizzle date() (string mode); HTML date input
      // already yields YYYY-MM-DD.
      date: date || null,
      url: url?.trim() || null,
      profile_id: profileId,
      sort: (lastItem?.sort ?? -1) + 1,
      status: "published",
      date_created: new Date(),
    });

    return { success: true };
  },

  update: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const name = formData.get("name") as string;
    const issuer = formData.get("issuer") as string;
    const date = formData.get("date") as string;
    const url = formData.get("url") as string;

    if (isNaN(id)) return fail(400, { error: "Invalid certificate ID" });
    if (!name || name.trim().length === 0) return fail(400, { error: "Certificate name is required" });

    const existing = await db.query.certificates.findFirst({
      where: and(eq(certificates.id, id), eq(certificates.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Certificate not found" });

    await db.update(certificates).set({
      name: name.trim(),
      issuer: issuer?.trim() || null,
      // certificates.date is a Drizzle date() column (string mode) — pass
      // the form value through; HTML date inputs already yield YYYY-MM-DD.
      date: date || null,
      url: url?.trim() || null,
      date_updated: new Date(),
    }).where(eq(certificates.id, id));

    return { success: true };
  },

  delete: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid certificate ID" });

    const existing = await db.query.certificates.findFirst({
      where: and(eq(certificates.id, id), eq(certificates.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Certificate not found" });

    await db.delete(certificates).where(eq(certificates.id, id));

    return { success: true };
  },
};
