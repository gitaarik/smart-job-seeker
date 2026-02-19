import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { importProfileFromJson } from "$lib/server/profile/import-profile-json";
import type { ExportedProfile } from "$lib/server/profile/export-profile-json";

export const load: PageServerLoad = async ({ parent }) => {
  await parent();
  return {};
};

export const actions: Actions = {
  importJson: async ({ request, locals }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

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
      result = await importProfileFromJson(data, user.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Import failed";
      return fail(500, { error: message });
    }

    redirect(302, `/dashboard?profile=${result.profileId}`);
  },
};
