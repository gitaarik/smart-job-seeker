import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { and, asc, eq } from "drizzle-orm";
import {
  applications,
  applications_files,
  profile_versions,
} from "$lib/server/db/schema";
import { getSelectedProfileId } from "../../../profile/utils";
import { deleteFile, uploadFile } from "$lib/server/files";
import { getHiddenRequiredSkills } from "$lib/server/profile/hidden-required-skills";
import { Buffer } from "buffer";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }

  const requiredSkills = layoutData.application?.job?.skills_required;

  const [profileVersions, hiddenRequiredSkills] = await Promise.all([
    db.query.profile_versions.findMany({
      where: and(
        eq(profile_versions.profile_id, layoutData.selectedProfile.id),
        eq(profile_versions.status, "published"),
      ),
      columns: { slug: true, name: true },
      orderBy: asc(profile_versions.sort),
    }),
    // Precomputed for every template × version pair rather than just the saved
    // one: the type and version pickers are unsaved client state, so the page
    // must be able to answer for whatever the applicant is currently eyeing.
    getHiddenRequiredSkills(
      layoutData.selectedProfile.id,
      Array.isArray(requiredSkills) ? requiredSkills as string[] : [],
    ),
  ]);

  return {
    versions: profileVersions.filter((v) => v.slug && v.name) as {
      slug: string;
      name: string;
    }[],
    hiddenRequiredSkills,
  };
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const actions: Actions = {
  /**
   * Accepts one or more files under the `file` key. The client uploads a batch
   * one request at a time (BODY_SIZE_LIMIT applies per request, so a batch
   * would be rejected wholesale rather than per-file), but the action stays
   * multi-file so a single request carrying several is handled correctly too.
   */
  uploadFile: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const existing = await db.query.applications.findFirst({
      where: and(
        eq(applications.id, appId),
        eq(applications.profile_id, profileId),
      ),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const uploads = formData.getAll("file").filter(
      (f): f is File => f instanceof File && f.size > 0,
    );

    if (uploads.length === 0) {
      return fail(400, { error: "No file selected" });
    }

    // Partial success: one rejected file must not discard the rest of a batch.
    const errors: { filename: string; error: string }[] = [];
    let uploaded = 0;

    for (const file of uploads) {
      if (file.size > MAX_FILE_BYTES) {
        errors.push({ filename: file.name, error: "Exceeds the 10MB limit" });
        continue;
      }
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const stored = await uploadFile({
          filename: file.name,
          buffer,
          title: file.name,
        });
        await db.insert(applications_files).values({
          applications_id: appId,
          file_id: stored.id,
        });
        uploaded++;
      } catch (err) {
        errors.push({ filename: file.name, error: (err as Error).message });
      }
    }

    // Nothing landed — report it as a failure so a plain form post surfaces it
    // as `form.error` rather than looking like a success.
    if (uploaded === 0) {
      return fail(400, {
        error: errors.map((e) => `${e.filename}: ${e.error}`).join("; ") ||
          "Upload failed",
      });
    }

    return { success: true, uploaded, errors };
  },

  deleteFile: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const existing = await db.query.applications.findFirst({
      where: and(
        eq(applications.id, appId),
        eq(applications.profile_id, profileId),
      ),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid file record ID" });

    const fileRecord = await db.query.applications_files.findFirst({
      where: and(
        eq(applications_files.id, id),
        eq(applications_files.applications_id, appId),
      ),
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
      where: and(
        eq(applications.id, appId),
        eq(applications.profile_id, profileId),
      ),
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
