#!/usr/bin/env node
/**
 * Dev-only: trigger a platform-discovery run without going through the admin
 * API. Mirrors POST /api/admin/discover. Picks credential + device by reusing
 * whatever the most recent run on this platform used, falling back to the
 * first available credential.
 *
 * Usage (from cloud/):
 *   npm run trigger-discover -- <platform-id>
 *   npm run trigger-discover -- <platform-id> --credential <id>
 *   npm run trigger-discover -- <platform-id> --device <api-key-id>
 *
 * Skips ownership and credit checks — do not expose this on a public host.
 */

import { desc, eq } from "drizzle-orm";
import { dbDirect as db } from "$lib/server/db";
import {
  api_keys,
  job_platforms,
  search_form_probe_runs,
  platform_profiles,
} from "$lib/server/db/schema";
import { addSearchFormProbeJob } from "$lib/server/queue/search-form-probe-queue";

function parseFlag(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

async function main() {
  const platformArg = process.argv[2];
  const platformId = platformArg ? parseInt(platformArg, 10) : NaN;
  if (!Number.isFinite(platformId)) {
    console.error(
      "Usage: npm run trigger-discover -- <platform-id> [--credential <id>] [--device <api-key-id>]",
    );
    process.exit(1);
  }

  const platform = await db.query.job_platforms.findFirst({
    where: eq(job_platforms.id, platformId),
    columns: { id: true, name: true, url: true, login_page_url: true },
  });
  if (!platform) {
    console.error(`Platform ${platformId} not found`);
    process.exit(1);
  }
  if (!platform.url) {
    console.error(`Platform ${platformId} has no base URL`);
    process.exit(1);
  }
  if (!platform.login_page_url) {
    console.error(
      `Platform ${platformId} has no login_page_url — set one before running discovery`,
    );
    process.exit(1);
  }

  const previousRun = await db.query.search_form_probe_runs.findFirst({
    where: eq(search_form_probe_runs.platform_id, platform.id),
    orderBy: desc(search_form_probe_runs.started_at),
    columns: {
      platform_profile_id: true,
      sjsbrowser_api_key_id: true,
      triggered_by_user_id: true,
    },
  });

  const credFlag = parseFlag("credential");
  let credentialId: number | null = credFlag
    ? parseInt(credFlag, 10)
    : previousRun?.platform_profile_id ?? null;
  if (credentialId === null) {
    const firstCred = await db.query.platform_profiles.findFirst({
      where: eq(platform_profiles.platform_id, platform.id),
      columns: { id: true },
    });
    if (!firstCred) {
      console.error(
        `No credentials for platform ${platformId} — create one first`,
      );
      process.exit(1);
    }
    credentialId = firstCred.id;
  }
  if (!Number.isFinite(credentialId)) {
    console.error("Invalid --credential value");
    process.exit(1);
  }
  const cred = await db.query.platform_profiles.findFirst({
    where: eq(platform_profiles.id, credentialId!),
    columns: { id: true, platform_id: true, username: true },
  });
  if (!cred || cred.platform_id !== platform.id) {
    console.error(
      `Credential ${credentialId} not found or belongs to a different platform`,
    );
    process.exit(1);
  }

  const deviceFlag = parseFlag("device");
  let deviceId: number | null = deviceFlag
    ? parseInt(deviceFlag, 10)
    : previousRun?.sjsbrowser_api_key_id ?? null;
  if (deviceId !== null && !Number.isFinite(deviceId)) {
    console.error("Invalid --device value");
    process.exit(1);
  }
  let deviceLabel: string | null = null;
  if (deviceId !== null) {
    const dev = await db.query.api_keys.findFirst({
      where: eq(api_keys.id, deviceId),
      columns: { id: true, name: true },
    });
    if (!dev) {
      console.error(`Device ${deviceId} not found`);
      process.exit(1);
    }
    deviceLabel = dev.name;
  }

  const [run] = await db.insert(search_form_probe_runs).values({
    platform_id: platform.id,
    target_url: platform.url,
    status: "queued",
    triggered_by_user_id: previousRun?.triggered_by_user_id ?? null,
    platform_profile_id: credentialId,
    sjsbrowser_api_key_id: deviceId,
  }).returning();

  const job = await addSearchFormProbeJob({
    discoveryRunId: run.id,
    targetUrl: platform.url,
    triggeredByUserId: previousRun?.triggered_by_user_id ?? "trigger-discover",
  });

  await db.update(search_form_probe_runs)
    .set({ bullmq_job_id: job.id ?? null })
    .where(eq(search_form_probe_runs.id, run.id));

  console.log(
    `Queued discovery run ${run.id} for platform ${platform.id} (${platform.name})\n` +
      `  credential: #${cred.id} (${cred.username ?? "no username"})\n` +
      `  device:     ${deviceLabel ? `#${deviceId} (${deviceLabel})` : "(none — local browser)"}\n` +
      `  bullmq job: ${job.id ?? "(unknown)"}\n` +
      `  watch logs: SELECT * FROM search_form_probe_logs WHERE discovery_run_id = ${run.id} ORDER BY id;`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("trigger-discover failed:", err);
  process.exit(1);
});
