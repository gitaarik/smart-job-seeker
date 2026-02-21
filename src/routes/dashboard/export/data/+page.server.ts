import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";
import { createProfileExport } from "$lib/server/profile/exports";
import { buildExportUrl } from "$lib/server/utils/export-url-builder";
import {
  buildProfileExport,
  buildFullExport,
  createExportZip,
  getProfileName,
  type ExportScope,
} from "$lib/server/export";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard/profile");
  }

  const exports = await db.profile_exports.findMany({
    where: {
      profile: layoutData.selectedProfile.id,
      export_type: "structured_data",
    },
    include: {
      directus_files: true,
    },
    orderBy: { date_created: "desc" },
  });

  return {
    exports,
    profileId: layoutData.selectedProfile.id,
    profileName: layoutData.selectedProfile.name,
  };
};

export const actions: Actions = {
  export: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const scope = (formData.get("scope") as ExportScope) || "profile";
    const includeMedia = formData.get("includeMedia") === "true";

    try {
      // Build export data
      const { data: exportData, mediaFiles } =
        scope === "full"
          ? await buildFullExport(profileId, includeMedia)
          : await buildProfileExport(profileId, includeMedia);

      const profileName = await getProfileName(profileId);
      const hasMedia = includeMedia && mediaFiles.length > 0;

      let buffer: Buffer;
      let filename: string;
      let contentType: string;
      let fileType: string;

      if (hasMedia) {
        // Create ZIP with media files
        buffer = await createExportZip(exportData, mediaFiles);
        filename = `${profileName}-${scope}${hasMedia ? "-with-media" : ""}.zip`;
        contentType = "application/zip";
        fileType = "zip";
      } else {
        // Create JSON only
        const jsonString = JSON.stringify(exportData, null, 2);
        buffer = Buffer.from(jsonString, "utf-8");
        filename = `${profileName}-${scope}.json`;
        contentType = "application/json";
        fileType = "json";
      }

      const sourceUrl = buildExportUrl({
        route: `api/profile/${profileId}/export`,
      });

      await createProfileExport({
        profileId,
        fileBuffer: buffer,
        filename,
        fileType,
        exportType: "structured_data",
        exportFormat: `${scope}_${hasMedia ? "zip" : "json"}`,
        description: `${scope === "full" ? "Full account" : "Profile"} export${hasMedia ? " with media" : ""} for ${profileName}`,
        sourceUrl,
      });

      return { success: true };
    } catch (error) {
      console.error("Export failed:", error);
      return fail(500, {
        error: error instanceof Error ? error.message : "Export failed",
      });
    }
  },
};
