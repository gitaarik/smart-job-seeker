import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, asc } from "drizzle-orm";
import { applications, applications_files, profile_versions } from "$lib/server/db/schema";
import { getSelectedProfileId } from "../../../profile/utils";
import { deleteFile, uploadFile } from "$lib/server/files";
import { Buffer } from "buffer";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const profileVersions = await db.query.profile_versions.findMany({
    where: and(eq(profile_versions.profile_id, layoutData.selectedProfile.id), eq(profile_versions.status, "published")),
    columns: { slug: true, name: true },
    orderBy: asc(profile_versions.sort),
  });

  return {
    versions: profileVersions.filter((v) => v.slug && v.name) as { slug: string; name: string }[],
  };
};

export const actions: Actions = {
  uploadFile: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const existing = await db.query.applications.findFirst({
      where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return fail(400, { error: "No file selected" });
    }

    if (file.size > 10 * 1024 * 1024) {
      return fail(400, { error: "File size exceeds 10MB limit" });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploaded = await uploadFile({
      filename: file.name,
      buffer,
      title: file.name,
    });

    await db.insert(applications_files).values({
      applications_id: appId,
      file_id: uploaded.id,
    });

    return { success: true };
  },

  deleteFile: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const existing = await db.query.applications.findFirst({
      where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid file record ID" });

    const fileRecord = await db.query.applications_files.findFirst({
      where: and(eq(applications_files.id, id), eq(applications_files.applications_id, appId)),
    });
    if (!fileRecord) return fail(404, { error: "File record not found" });

    // Delete the junction record
    await db.delete(applications_files).where(eq(applications_files.id, id));

    // Delete the file
    if (fileRecord.file_id) {
      try {
        await deleteFile(fileRecord.file_id);
      } catch {
        // File may already be deleted, continue
      }
    }

    return { success: true };
  },

  setCvSent: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const existing = await db.query.applications.findFirst({
      where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const versionSlug = (formData.get("version_slug") as string) || null;
    const cvSentThrough = (formData.get("cv_sent_through") as string) || null;

    await db.update(applications).set({
      cv_version_sent: versionSlug,
      cv_sent_through: cvSentThrough,
      date_updated: new Date(),
    }).where(eq(applications.id, appId));

    return { success: true };
  },
};
