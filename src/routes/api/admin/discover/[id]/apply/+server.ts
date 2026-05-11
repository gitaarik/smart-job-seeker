/**
 * POST /api/admin/discover/[id]/apply
 *
 * Promotes a finished discovery run's findings onto the existing
 * job_platforms row that triggered it: updates login_page_url and creates
 * (or updates) the Generic-search preset. Admin can override any field via
 * the request body — run.findings are the defaults.
 *
 * Body (all optional):
 *   { login_page_url, search_url_template, applicable_hint }
 */
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, eq } from "drizzle-orm";
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
  if (run.applied_at) {
    throw error(400, "Run already applied");
  }
  if (!run.platform_id) {
    throw error(400, "Run has no associated platform (legacy)");
  }

  const body = (await request.json().catch(() => ({}))) as {
    login_page_url?: string | null;
    search_url_template?: string | null;
    applicable_hint?: string | null;
  };

  const findings = run.findings ?? {};
  const loginPageUrl = body.login_page_url ?? findings.login_page_url ?? null;
  const searchUrlTemplate = body.search_url_template ??
    findings.search_url_template ?? null;
  const applicableHint = body.applicable_hint ?? findings.applicable_hint ??
    null;

  const platform = await db.query.job_platforms.findFirst({
    where: eq(job_platforms.id, run.platform_id),
    columns: { id: true },
  });
  if (!platform) throw error(404, "Platform no longer exists");

  // Update login URL on the existing platform.
  if (loginPageUrl !== null) {
    await db.update(job_platforms)
      .set({ login_page_url: loginPageUrl })
      .where(eq(job_platforms.id, platform.id));
  }

  // Upsert the Generic-search preset for this platform.
  let presetId: number | null = null;
  if (searchUrlTemplate) {
    const existing = await db.query.job_platform_search_presets.findFirst({
      where: and(
        eq(job_platform_search_presets.platform_id, platform.id),
        eq(job_platform_search_presets.label, "Generic search"),
      ),
      columns: { id: true },
    });
    if (existing) {
      await db.update(job_platform_search_presets).set({
        url_template: searchUrlTemplate,
        applicable_hint: applicableHint,
        date_updated: new Date(),
      }).where(eq(job_platform_search_presets.id, existing.id));
      presetId = existing.id;
    } else {
      const [preset] = await db.insert(job_platform_search_presets).values({
        platform_id: platform.id,
        label: "Generic search",
        url_template: searchUrlTemplate,
        applicable_hint: applicableHint,
        // Stays out of the suggestion pool until an admin sets a priority.
        suggestion_priority: null,
        params: {},
      }).returning();
      presetId = preset.id;
    }
  }

  await db.update(platform_discovery_runs)
    .set({ applied_at: new Date(), applied_platform_id: platform.id })
    .where(eq(platform_discovery_runs.id, id));

  return json({ platform_id: platform.id, preset_id: presetId });
};
