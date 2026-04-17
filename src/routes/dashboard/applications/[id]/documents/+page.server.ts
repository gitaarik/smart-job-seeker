import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../../profile/utils";
import { deleteFile, uploadFile } from "$lib/server/files";
import { Buffer } from "buffer";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const profileVersions = await db.profile_versions.findMany({
    where: {
      profile_id: layoutData.selectedProfile.id,
      status: "published",
    },
    select: { slug: true, name: true },
    orderBy: { sort: "asc" },
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

    const existing = await db.applications.findFirst({
      where: { id: appId, profile_id: profileId },
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

    await db.applications_files.create({
      data: {
        applications_id: appId,
        directus_files_id: uploaded.id,
      },
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

    const existing = await db.applications.findFirst({
      where: { id: appId, profile_id: profileId },
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid file record ID" });

    const fileRecord = await db.applications_files.findFirst({
      where: { id, applications_id: appId },
    });
    if (!fileRecord) return fail(404, { error: "File record not found" });

    // Delete the junction record
    await db.applications_files.delete({
      where: { id },
    });

    // Delete the file
    if (fileRecord.directus_files_id) {
      try {
        await deleteFile(fileRecord.directus_files_id);
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

    const existing = await db.applications.findFirst({
      where: { id: appId, profile_id: profileId },
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const versionSlug = (formData.get("version_slug") as string) || null;
    const cvSentThrough = (formData.get("cv_sent_through") as string) || null;

    await db.applications.update({
      where: { id: appId },
      data: {
        cv_version_sent: versionSlug,
        cv_sent_through: cvSentThrough,
        date_updated: new Date(),
      },
    });

    return { success: true };
  },
};
