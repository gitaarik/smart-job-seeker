import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  job_platform_changes,
  job_platform_search_presets,
  job_platforms,
} from "$lib/server/db/schema";
import { updatePlatformWithAudit } from "$lib/server/job-platforms/admin";

export const load: PageServerLoad = async ({ params }) => {
  const platformId = parseInt(params.id, 10);
  if (isNaN(platformId)) error(400, "Invalid platform id");

  const platform = await db.query.job_platforms.findFirst({
    where: eq(job_platforms.id, platformId),
  });
  if (!platform) error(404, "Platform not found");

  const [presets, history] = await Promise.all([
    db.query.job_platform_search_presets.findMany({
      where: eq(job_platform_search_presets.platform_id, platformId),
      orderBy: [
        asc(job_platform_search_presets.suggestion_priority),
        asc(job_platform_search_presets.id),
      ],
    }),
    db.query.job_platform_changes.findMany({
      where: eq(job_platform_changes.platform_id, platformId),
      orderBy: desc(job_platform_changes.changed_at),
      limit: 50,
    }),
  ]);

  return { platform, presets, history };
};

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

  /** Create a new search preset for this platform. */
  addPreset: async ({ params, request, locals }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const platformId = parseInt(params.id ?? "", 10);
    if (isNaN(platformId)) return fail(400, { error: "Invalid platform id" });

    const formData = await request.formData();
    const label = parseNullableString(formData.get("label"));
    const url_template = parseNullableString(formData.get("url_template"));
    const applicable_hint = parseNullableString(formData.get("applicable_hint"));
    const suggestion_priority = parsePriority(formData.get("suggestion_priority"));

    if (!label) return fail(400, { error: "Label is required" });
    if (!url_template) return fail(400, { error: "URL template is required" });

    try {
      const [created] = await db.insert(job_platform_search_presets).values({
        platform_id: platformId,
        label,
        url_template,
        applicable_hint,
        suggestion_priority,
      }).returning();
      return { success: true, presetId: created.id };
    } catch (err) {
      return fail(500, {
        error: err instanceof Error ? err.message : "Add preset failed",
      });
    }
  },

  /** Update an existing preset. */
  updatePreset: async ({ params, request, locals }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const platformId = parseInt(params.id ?? "", 10);
    if (isNaN(platformId)) return fail(400, { error: "Invalid platform id" });

    const formData = await request.formData();
    const presetId = parsePriority(formData.get("preset_id"));
    const label = parseNullableString(formData.get("label"));
    const url_template = parseNullableString(formData.get("url_template"));
    const applicable_hint = parseNullableString(formData.get("applicable_hint"));
    const suggestion_priority = parsePriority(formData.get("suggestion_priority"));

    if (presetId == null) return fail(400, { error: "preset_id required" });
    if (!label) return fail(400, { error: "Label is required" });
    if (!url_template) return fail(400, { error: "URL template is required" });

    try {
      await db.update(job_platform_search_presets).set({
        label,
        url_template,
        applicable_hint,
        suggestion_priority,
        date_updated: new Date(),
      }).where(and(
        eq(job_platform_search_presets.id, presetId),
        eq(job_platform_search_presets.platform_id, platformId),
      ));
      return { success: true, presetId };
    } catch (err) {
      return fail(500, {
        error: err instanceof Error ? err.message : "Update preset failed",
      });
    }
  },

  /** Delete a preset. Cascades won't affect tasks (FK is ON DELETE SET NULL). */
  deletePreset: async ({ params, request, locals }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const platformId = parseInt(params.id ?? "", 10);
    if (isNaN(platformId)) return fail(400, { error: "Invalid platform id" });

    const formData = await request.formData();
    const presetId = parsePriority(formData.get("preset_id"));
    if (presetId == null) return fail(400, { error: "preset_id required" });

    try {
      await db.delete(job_platform_search_presets).where(and(
        eq(job_platform_search_presets.id, presetId),
        eq(job_platform_search_presets.platform_id, platformId),
      ));
      return { success: true, deletedPresetId: presetId };
    } catch (err) {
      return fail(500, {
        error: err instanceof Error ? err.message : "Delete preset failed",
      });
    }
  },

  /**
   * Fetches a preset's URL with sample keywords/location and returns enough
   * info to spot obviously-broken templates: HTTP status, response length,
   * and whether the body has any hint of job listings. Many job sites block
   * direct fetches (anti-bot) so a 403 is informational, not a guaranteed
   * failure — surface it as a yellow flag in the UI rather than a hard fail.
   */
  testPreset: async ({ request }) => {
    const formData = await request.formData();
    const template = parseNullableString(formData.get("url_template"));
    const keywords = parseString(formData.get("test_keywords")).trim() || "engineer";
    const location = parseString(formData.get("test_location")).trim();

    if (!template) {
      return fail(400, { error: "No URL template to test" });
    }

    const testUrl = template
      .replace(/\{KEYWORDS\}/g, encodeURIComponent(keywords))
      .replace(/\{LOCATION\}/g, encodeURIComponent(location));

    let status = 0;
    let contentLength = 0;
    let bodyPreview = "";
    let lookedLikeJobs = false;
    let networkError: string | null = null;

    try {
      const resp = await fetch(testUrl, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      status = resp.status;
      const text = await resp.text();
      contentLength = text.length;
      bodyPreview = text.slice(0, 500);
      const matches = text.match(/\b(job|position|career|opening|hiring)\b/gi);
      lookedLikeJobs = (matches?.length ?? 0) >= 3;
    } catch (err) {
      networkError = err instanceof Error ? err.message : String(err);
    }

    return {
      testResult: {
        testUrl,
        status,
        contentLength,
        lookedLikeJobs,
        networkError,
        bodyPreview,
      },
    };
  },
};
