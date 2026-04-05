import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../../profile/utils";
import {
  deleteFileFromDirectus,
  uploadFileToDirectus,
} from "$lib/server/directus/files";
import { Buffer } from "buffer";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const [profileExports, profileVersions] = await Promise.all([
    db.profile_exports.findMany({
      where: {
        profile: layoutData.selectedProfile.id,
        status: "published",
        export_type: { in: ["resume", "cv"] },
      },
      include: {
        directus_files: {
          select: {
            id: true,
            filename_download: true,
            type: true,
            filesize: true,
          },
        },
      },
      orderBy: { date_created: "desc" },
    }),
    db.profile_versions.findMany({
      where: {
        profile: layoutData.selectedProfile.id,
        status: "published",
      },
      select: { slug: true, name: true },
      orderBy: { sort: "asc" },
    }),
  ]);

  // Build version options: for each version+type combo, find the latest export file
  type VersionOption = { slug: string; name: string; fileId: string | null };
  const versionOptions: Record<string, VersionOption[]> = { cv: [], resume: [] };

  for (const version of profileVersions) {
    if (!version.slug || !version.name) continue;
    for (const type of ["cv", "resume"] as const) {
      const latestExport = profileExports.find(
        (e) => e.export_type === type && e.description?.includes(`(${version.slug})`)
      );
      versionOptions[type].push({
        slug: version.slug,
        name: version.name,
        fileId: latestExport?.directus_files?.id ?? null,
      });
    }
  }

  return {
    profileExports,
    versionOptions,
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
      where: { id: appId, profile: profileId },
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

    const uploaded = await uploadFileToDirectus({
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
      where: { id: appId, profile: profileId },
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

    // Delete the file from Directus
    if (fileRecord.directus_files_id) {
      try {
        await deleteFileFromDirectus(fileRecord.directus_files_id);
      } catch {
        // File may already be deleted from Directus, continue
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
      where: { id: appId, profile: profileId },
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const fileId = (formData.get("file_id") as string) || "";
    const cvSentThrough = (formData.get("cv_sent_through") as string) || null;

    await db.applications.update({
      where: { id: appId },
      data: {
        cv_file_sent: fileId || null,
        cv_sent_through: cvSentThrough,
        date_updated: new Date(),
      },
    });

    return { success: true };
  },
};
