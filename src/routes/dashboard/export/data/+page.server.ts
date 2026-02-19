import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";
import { buildProfileJsonExport } from "$lib/server/profile/export-profile-json";
import { createProfileExport } from "$lib/server/profile/exports";
import { buildExportUrl } from "$lib/server/utils/export-url-builder";

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
  };
};

export const actions: Actions = {
  exportJson: async ({ locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const { data: exportData, profileName } =
      await buildProfileJsonExport(profileId);

    const jsonString = JSON.stringify(exportData, null, 2);
    const buffer = Buffer.from(jsonString, "utf-8");

    const sourceUrl = buildExportUrl({
      route: `api/profile/${profileId}/export.json`,
    });

    await createProfileExport({
      profileId,
      fileBuffer: buffer,
      filename: `${profileName}.json`,
      fileType: "json",
      exportType: "structured_data",
      exportFormat: "profile_json",
      description: `Profile data export for ${profileName}`,
      sourceUrl,
    });

    return { success: true };
  },
};
