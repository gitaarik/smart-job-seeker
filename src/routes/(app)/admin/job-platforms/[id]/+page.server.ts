import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { desc, eq } from "drizzle-orm";
import {
  job_platform_changes,
  job_platforms,
  search_form_probe_runs,
} from "$lib/server/db/schema";
import { updatePlatformWithAudit } from "$lib/server/job-platforms/admin";

export const load: PageServerLoad = async ({ params, locals }) => {
  const platformId = parseInt(params.id, 10);
  if (isNaN(platformId)) error(400, "Invalid platform id");

  const platform = await db.query.job_platforms.findFirst({
    where: eq(job_platforms.id, platformId),
  });
  if (!platform) error(404, "Platform not found");

  const user = locals.user;
  if (!user) error(401, "Not authenticated");

  const [history, discoveryRuns] = await Promise.all([
    db.query.job_platform_changes.findMany({
      where: eq(job_platform_changes.platform_id, platformId),
      orderBy: desc(job_platform_changes.changed_at),
      limit: 50,
    }),
    db.query.search_form_probe_runs.findMany({
      where: eq(search_form_probe_runs.platform_id, platformId),
      orderBy: desc(search_form_probe_runs.started_at),
      limit: 10,
    }),
  ]);

  return {
    platform,
    history,
    discoveryRuns,
  };
};

/** Lenient nullable-int parser for priority fields. Accepts negatives and
 *  zero — caller should clamp/range-check if those are wrong for its use. */
function parsePriority(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;
  const n = parseInt(trimmed, 10);
  if (isNaN(n)) return null;
  return n;
}

function parseString(raw: FormDataEntryValue | null): string {
  return raw === null ? "" : String(raw);
}

function parseNullableString(raw: FormDataEntryValue | null): string | null {
  if (raw === null) return null;
  const trimmed = String(raw).trim();
  return trimmed.length === 0 ? null : trimmed;
}

export const actions: Actions = {
  /** Save platform-level fields (name, status, suggestion_priority, etc.) */
  save: async ({ params, request, locals }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const platformId = parseInt(params.id ?? "", 10);
    if (isNaN(platformId)) return fail(400, { error: "Invalid platform id" });

    const formData = await request.formData();

    try {
      const result = await updatePlatformWithAudit(platformId, user.id, {
        name: parseString(formData.get("name")),
        key: parseString(formData.get("key")),
        url: parseString(formData.get("url")),
        type: parseNullableString(formData.get("type")),
        status: parseString(formData.get("status")),
        login_page_url: parseNullableString(formData.get("login_page_url")),
        suggestion_priority: parsePriority(formData.get("suggestion_priority")),
        suggestion_hint: parseNullableString(formData.get("suggestion_hint")),
      });
      return { success: true, savedFields: result.changedFields };
    } catch (err) {
      return fail(500, {
        error: err instanceof Error ? err.message : "Save failed",
      });
    }
  },
};
