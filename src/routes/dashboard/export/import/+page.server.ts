import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect, isRedirect } from "@sveltejs/kit";
import { getSelectedProfileId } from "../../profile/utils";
import {
  importExportData,
  validateExportData,
  isLegacyFormat,
  parseExportZip,
  importMediaFiles,
  deleteProfileMediaFiles,
  type ExportData,
} from "$lib/server/export";
import { importProfileFromJson } from "$lib/server/profile/import-profile-json";
import type { ExportedProfile } from "$lib/server/profile/export-profile-json";
import { getProfileAsResumeData } from "$lib/server/resume/profile-to-resume-data";
import { applyDiffToProfile, type DiffApplyPayload } from "$lib/server/resume/apply-diff";
import { logImportEvent } from "$lib/server/import-log";
import { dbDirect as db } from "$lib/server/db";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();
  const profile = layoutData.selectedProfile;
  const user = layoutData.user;

  let currentProfileData = null;
  if (profile?.id) {
    try {
      currentProfileData = await getProfileAsResumeData(profile.id);
    } catch {
      // Profile may have no data yet
    }
  }

  // Load recent import logs for admins
  const isAdmin = (user as { is_admin?: boolean })?.is_admin || !!layoutData.adminUser;
  let importLogs: Array<{
    id: number;
    date_created: string;
    user_email: string | null;
    profile_id: number | null;
    event: string;
    file_name: string | null;
    file_format: string | null;
    doc_type: string | null;
    sections: unknown;
    changes: unknown;
    parsed_data: unknown;
    file_id: string | null;
    error: string | null;
  }> = [];

  if (isAdmin) {
    try {
      const logs = await db.import_logs.findMany({
        orderBy: { date_created: "desc" },
        take: 50,
      });
      importLogs = logs.map((l) => ({
        ...l,
        date_created: l.date_created.toISOString(),
      }));
    } catch {
      // Table may not exist yet
    }
  }

  return {
    selectedProfileName: profile?.name || "Current Profile",
    selectedProfileId: profile?.id,
    currentProfileData,
    importLogs,
  };
};

export const actions: Actions = {
  import: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const importMode = formData.get("importMode") as string;

    if (!file || file.size === 0) {
      return fail(400, { error: "Please select a file to import" });
    }

    const isZip =
      file.name.endsWith(".zip") || file.type === "application/zip";
    const isJson =
      file.name.endsWith(".json") || file.type === "application/json";

    if (!isZip && !isJson) {
      return fail(400, { error: "Please upload a JSON or ZIP file" });
    }

    const MAX_SIZE = 100 * 1024 * 1024; // 100MB for ZIP files with media
    if (file.size > MAX_SIZE) {
      return fail(400, { error: "File is too large. Maximum size is 100MB." });
    }

    let overwriteProfileId: number | undefined;
    if (importMode === "overwrite") {
      const selectedId = await getSelectedProfileId(cookies, user.id);
      if (!selectedId) {
        return fail(400, { error: "No profile selected to overwrite" });
      }
      overwriteProfileId = selectedId;
    }

    try {
      if (isZip) {
        // Handle ZIP import (v2.0 format with media)
        const buffer = Buffer.from(await file.arrayBuffer());
        const { data, mediaFiles } = await parseExportZip(buffer);

        if (!validateExportData(data)) {
          return fail(400, { error: "Invalid export format in ZIP file" });
        }

        // Delete old media files if overwriting
        if (overwriteProfileId) {
          await deleteProfileMediaFiles(overwriteProfileId);
        }

        // Import data
        const result = await importExportData(data, user.id, {
          overwriteProfileId,
        });

        // Import media files if present
        if (data.has_media && data.media_files) {
          const mediaResult = await importMediaFiles(
            mediaFiles,
            data.media_files,
            result.profileId,
            result.mediaPathMapping,
          );

          if (mediaResult.failed > 0) {
            console.warn("Some media files failed to import:", mediaResult.errors);
          }
        }

        redirect(302, `/dashboard?profile=${result.profileId}`);
      } else {
        // Handle JSON import
        const text = await file.text();
        let data: unknown;

        try {
          data = JSON.parse(text);
        } catch {
          return fail(400, { error: "Invalid JSON file" });
        }

        // Check format version
        if (validateExportData(data)) {
          // v2.0 format
          const result = await importExportData(data as ExportData, user.id, {
            overwriteProfileId,
          });
          redirect(302, `/dashboard?profile=${result.profileId}`);
        } else if (isLegacyFormat(data)) {
          // Legacy v1.0 format - use old import function
          const legacyData = data as ExportedProfile;

          if (!legacyData.profile) {
            return fail(400, {
              error: "Invalid export format: missing profile data",
            });
          }

          const result = await importProfileFromJson(legacyData, user.id, {
            overwriteProfileId,
          });
          redirect(302, `/dashboard?profile=${result.profileId}`);
        } else {
          return fail(400, {
            error: "Invalid export format: unrecognized structure",
          });
        }
      }
    } catch (e) {
      // Re-throw redirects - they're not errors
      if (isRedirect(e)) {
        throw e;
      }
      console.error("Import failed:", e);
      const message = e instanceof Error ? e.message : "Import failed";
      return fail(500, { error: message });
    }
  },

  applyDiff: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const selectedId = await getSelectedProfileId(cookies, user.id);
    if (!selectedId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const payloadJson = formData.get("payload") as string;

    if (!payloadJson) {
      return fail(400, { error: "No diff payload provided" });
    }

    let payload: DiffApplyPayload;
    try {
      payload = JSON.parse(payloadJson);
    } catch {
      return fail(400, { error: "Invalid diff payload" });
    }

    await logImportEvent(user, "apply", { profileId: selectedId, payload });

    try {
      await applyDiffToProfile(selectedId, user.id, payload);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to apply changes";
      await logImportEvent(user, "apply_error", { profileId: selectedId, error: message }).catch(() => {});
      return fail(500, { error: message });
    }

    redirect(302, `/dashboard?profile=${selectedId}`);
  },

  // Keep legacy action for backwards compatibility
  importJson: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const importMode = formData.get("importMode") as string;

    if (!file || file.size === 0) {
      return fail(400, { error: "Please select a JSON file to import" });
    }

    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      return fail(400, { error: "Please upload a JSON file" });
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return fail(400, { error: "File is too large. Maximum size is 10MB." });
    }

    let data: ExportedProfile;
    try {
      const text = await file.text();
      data = JSON.parse(text);
    } catch {
      return fail(400, { error: "Invalid JSON file" });
    }

    if (!data.profile) {
      return fail(400, {
        error: "Invalid export format: missing profile data",
      });
    }

    let result: { profileId: number; profileName: string };
    try {
      if (importMode === "overwrite") {
        const profileId = await getSelectedProfileId(cookies, user.id);
        if (!profileId) {
          return fail(400, { error: "No profile selected to overwrite" });
        }
        result = await importProfileFromJson(data, user.id, {
          overwriteProfileId: profileId,
        });
      } else {
        result = await importProfileFromJson(data, user.id);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Import failed";
      return fail(500, { error: message });
    }

    redirect(302, `/dashboard?profile=${result.profileId}`);
  },
};
