/**
 * POST /api/admin/discover/[id]/apply
 *
 * Promotes a finished discovery run's findings into a real job_platforms
 * row + a draft Generic-search preset. Admin can override individual
 * fields in the request body — the run's findings are the defaults.
 *
 * Body (all optional, default to run.findings):
 *   { platform_name, platform_key, platform_url, login_page_url,
 *     search_url_template, applicable_hint }
 */
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import {
  job_platform_search_presets,
  job_platforms,
  platform_discovery_runs,
} from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";

function requireAdmin(locals: App.Locals) {
  const user = requireAuth(locals);
  if (!(user as { is_admin?: boolean }).is_admin) {
    throw error(403, "Admin access required");
  }
  return user;
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
  requireAdmin(locals);
  const id = parseInt(params.id ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) throw error(400, "Invalid run id");

  const run = await db.query.platform_discovery_runs.findFirst({
    where: eq(platform_discovery_runs.id, id),
  });
  if (!run) throw error(404, "Run not found");
  if (run.status !== "success") {
    throw error(400, "Run did not complete successfully");
  }
  if (run.applied_platform_id) {
    throw error(400, "Run already applied");
  }

  const body = (await request.json().catch(() => ({}))) as {
    platform_name?: string;
    platform_key?: string;
    platform_url?: string;
    login_page_url?: string | null;
    search_url_template?: string | null;
    applicable_hint?: string | null;
  };

  const findings = run.findings ?? {};
  const platformName = body.platform_name?.trim() ||
    findings.platform_name?.trim();
  let platformKey = body.platform_key?.trim() || findings.platform_key?.trim();
  const platformUrl = body.platform_url?.trim() || run.target_url;
  const loginPageUrl = body.login_page_url ?? findings.login_page_url ?? null;
  const searchUrlTemplate = body.search_url_template ??
    findings.search_url_template ?? null;
  const applicableHint = body.applicable_hint ?? findings.applicable_hint ??
    null;

  if (!platformName) throw error(400, "platform_name is required");
  if (!platformKey) throw error(400, "platform_key is required");

  // Ensure key uniqueness — append a suffix if a row with that key exists.
  let existing = await db.query.job_platforms.findFirst({
    where: eq(job_platforms.key, platformKey),
    columns: { id: true },
  });
  if (existing) {
    platformKey = `${platformKey}-${Date.now().toString(36)}`;
    existing = undefined;
  }

  const [platform] = await db.insert(job_platforms).values({
    name: platformName,
    url: platformUrl,
    key: platformKey,
    login_page_url: loginPageUrl,
    status: "draft",
    date_created: new Date(),
  }).returning();

  let presetId: number | null = null;
  if (searchUrlTemplate) {
    const [preset] = await db.insert(job_platform_search_presets).values({
      platform_id: platform.id,
      label: "Generic search",
      url_template: searchUrlTemplate,
      applicable_hint: applicableHint,
      // Discovery-created presets stay out of the suggestion pool until an
      // admin promotes them; populate suggestion_priority manually later.
      suggestion_priority: null,
      params: {},
    }).returning();
    presetId = preset.id;
  }

  await db.update(platform_discovery_runs)
    .set({ applied_platform_id: platform.id })
    .where(eq(platform_discovery_runs.id, id));

  return json({ platform_id: platform.id, preset_id: presetId });
};
