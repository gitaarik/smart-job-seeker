import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { getSelectedProfileId } from "../../../profile/utils";
import {
  importSettings,
  validateSettingsExport,
  type SettingsImportSummary,
} from "$lib/server/export";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }

  return {
    profileId: layoutData.selectedProfile.id,
    profileName: layoutData.selectedProfile.name,
  };
};

export const actions: Actions = {
  import: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { error: "No file uploaded" });
    }

    const replaceExistingTasks = formData.get("replaceExistingTasks") === "on";
    const applyMatchConfig = formData.get("applyMatchConfig") === "on";
    const applyEmailDigest = formData.get("applyEmailDigest") === "on";
    const applySalary = formData.get("applySalary") === "on";

    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      return fail(400, { error: "Could not parse file as JSON" });
    }

    if (!validateSettingsExport(parsed)) {
      return fail(400, {
        error: 'Not a valid settings export (expected scope: "settings")',
      });
    }

    let summary: SettingsImportSummary;
    try {
      summary = await importSettings(profileId, user.id, parsed, {
        replaceExistingTasks,
        applyMatchConfig,
        applyEmailDigest,
        applySalary,
      });
    } catch (err) {
      console.error("Settings import failed:", err);
      return fail(500, {
        error: err instanceof Error ? err.message : "Import failed",
      });
    }

    return { success: true, summary };
  },
};
