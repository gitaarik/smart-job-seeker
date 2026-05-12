/**
 * POST /api/admin/discover/[id]/start
 *
 * Transitions a draft discovery run to "queued" and enqueues the BullMQ job.
 * The admin picks credentials + device on the run detail page (kept on the
 * run row) and then calls this to actually start the worker.
 *
 * Body:
 *   { platform_profile_id, sjsbrowser_api_key_id? }
 *
 * platform_profile_id is required because discovery now requires login.
 */
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import {
  job_platforms,
  platform_discovery_runs,
  platform_profiles,
} from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";
import { addDiscoveryJob } from "$lib/server/queue/discovery-queue";
import { hasCredentialAccess } from "$lib/server/credential-shares";
import { hasDeviceAccess } from "$lib/server/device-shares";

function requireAdmin(locals: App.Locals) {
  const user = requireAuth(locals);
  if (!(user as { is_admin?: boolean }).is_admin) {
    throw error(403, "Admin access required");
  }
  return user;
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = requireAdmin(locals);
  const id = parseInt(params.id ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) throw error(400, "Invalid run id");

  const run = await db.query.platform_discovery_runs.findFirst({
    where: eq(platform_discovery_runs.id, id),
    columns: {
      id: true,
      platform_id: true,
      target_url: true,
      status: true,
    },
  });
  if (!run) throw error(404, "Run not found");
  if (run.status !== "draft") {
    throw error(400, `Run is not a draft (status: ${run.status})`);
  }

  const body = (await request.json().catch(() => ({}))) as {
    platform_profile_id?: number | null;
    sjsbrowser_api_key_id?: number | null;
  };

  const platform = await db.query.job_platforms.findFirst({
    where: eq(job_platforms.id, run.platform_id),
    columns: { id: true, login_page_url: true },
  });
  if (!platform) throw error(404, "Platform no longer exists");
  if (!platform.login_page_url) {
    throw error(
      400,
      "Platform has no login_page_url — set one before starting discovery",
    );
  }

  const credentialId = body.platform_profile_id ?? null;
  if (credentialId === null) {
    throw error(400, "platform_profile_id is required — discovery needs a login");
  }
  if (!Number.isInteger(credentialId) || credentialId <= 0) {
    throw error(400, "Invalid platform_profile_id");
  }
  const cred = await db.query.platform_profiles.findFirst({
    where: eq(platform_profiles.id, credentialId),
    columns: { id: true, platform_id: true },
  });
  if (!cred) throw error(404, "Credential not found");
  if (cred.platform_id !== platform.id) {
    throw error(400, "Credential is for a different platform");
  }
  const canAccessCred = await hasCredentialAccess(cred.id, user.id);
  if (!canAccessCred) {
    throw error(403, "You don't have access to this credential");
  }

  const deviceId = body.sjsbrowser_api_key_id ?? null;
  if (deviceId !== null) {
    if (!Number.isInteger(deviceId) || deviceId <= 0) {
      throw error(400, "Invalid sjsbrowser_api_key_id");
    }
    const canAccessDev = await hasDeviceAccess(deviceId, user.id);
    if (!canAccessDev) {
      throw error(403, "You don't have access to this device");
    }
  }

  await db.update(platform_discovery_runs).set({
    status: "queued",
    started_at: new Date(),
    platform_profile_id: credentialId,
    sjsbrowser_api_key_id: deviceId,
  }).where(eq(platform_discovery_runs.id, run.id));

  const job = await addDiscoveryJob({
    discoveryRunId: run.id,
    targetUrl: run.target_url,
    triggeredByUserId: user.id,
  });

  await db.update(platform_discovery_runs)
    .set({ bullmq_job_id: job.id ?? null })
    .where(eq(platform_discovery_runs.id, run.id));

  const updated = await db.query.platform_discovery_runs.findFirst({
    where: eq(platform_discovery_runs.id, run.id),
  });

  return json({ run: updated });
};
