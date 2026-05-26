import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import { getSelectedProfileId } from "../../../../profile/utils";
import {
  buildSettingsExport,
  getProfileName,
  type SettingsExportOptions,
} from "$lib/server/export";

function parseFlag(url: URL, key: string): boolean {
  const v = url.searchParams.get(key);
  // Default to true so a bare /download URL still works.
  if (v === null) return true;
  return v === "1" || v === "true";
}

export const GET: RequestHandler = async ({ locals, cookies, url }) => {
  const user = locals.user;
  if (!user) error(401, "Not authenticated");

  const profileId = await getSelectedProfileId(cookies, user.id);
  if (!profileId) error(400, "No profile selected");

  const options: SettingsExportOptions = {
    includeTasks: parseFlag(url, "tasks"),
    includeMatchConfig: parseFlag(url, "match"),
    includeEmailDigest: parseFlag(url, "digest"),
    includeSalary: parseFlag(url, "salary"),
  };

  const data = await buildSettingsExport(profileId, options);
  const profileName = await getProfileName(profileId);
  const filename = `${profileName}-settings.json`;

  const json = JSON.stringify(data, null, 2);

  return new Response(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
};
