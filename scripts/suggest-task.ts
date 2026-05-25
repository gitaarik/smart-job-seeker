#!/usr/bin/env node
/**
 * Dev-only: ask the LLM suggester to draft an import task for a specific
 * platform, and optionally insert it. Calls _runSuggester() directly so it
 * doesn't need an HTTP session cookie.
 *
 * Usage (from cloud/, via npm script):
 *   npm run suggest-task -- <profile_id> <platform_id>            # dry-run
 *   npm run suggest-task -- <profile_id> <platform_id> insert     # insert
 *
 * Skips auth checks, so do not expose on a public host.
 */

import { and, desc, eq } from "drizzle-orm";
import { dbDirect as db } from "$lib/server/db";
import {
  platform_profiles,
  profiles,
  search_tasks,
} from "$lib/server/db/schema";
import { _runSuggester } from "../src/routes/api/jobs/import/suggest/+server";

function parseArgs(argv: string[]): {
  profileId: number;
  platformId: number;
  save: boolean;
} {
  const positional = argv.filter((a) => !a.startsWith("-"));
  // Accept `insert` as a positional flag too — npm + docker-compose-exec
  // wrappers strip leading-dash flags silently, so a leading-dash form can't
  // ride through them. Both forms work; the positional one survives.
  const save = argv.includes("--insert") || positional.includes("insert");
  const args = positional.filter((a) => a !== "insert");
  if (args.length < 2) {
    console.error(
      "Usage: npm run suggest-task -- <profile_id> <platform_id> [insert]",
    );
    process.exit(1);
  }
  const profileId = parseInt(args[0], 10);
  const platformId = parseInt(args[1], 10);
  if (!Number.isInteger(profileId) || profileId <= 0) {
    console.error(`Invalid profile_id "${positional[0]}"`);
    process.exit(1);
  }
  if (!Number.isInteger(platformId) || platformId <= 0) {
    console.error(`Invalid platform_id "${positional[1]}"`);
    process.exit(1);
  }
  return { profileId, platformId, save };
}

async function main() {
  const { profileId, platformId, save } = parseArgs(process.argv.slice(2));

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
    columns: { id: true, name: true, user_id: true },
  });
  if (!profile) {
    console.error(`Profile ${profileId} not found`);
    process.exit(1);
  }

  const result = await _runSuggester(profileId, platformId);
  if (!result.ok) {
    console.error(`Suggester failed (${result.status}): ${result.message}`);
    process.exit(1);
  }
  if (result.tasks.length === 0) {
    console.error(
      `No task suggestion returned for platform ${platformId}` +
        (result.message ? ` (${result.message})` : ""),
    );
    process.exit(1);
  }

  const draft = result.tasks[0];
  console.log("Suggested task:");
  console.log(`  platform:   ${draft.platform_name} (id=${draft.platform_id})`);
  console.log(`  keywords:   ${JSON.stringify(draft.keywords)}`);
  console.log(`  filters:    ${JSON.stringify(draft.filters)}`);
  console.log(`  note:       ${JSON.stringify(draft.note)}`);
  console.log(`  relevance:  ${draft.relevance}`);

  if (!save) {
    console.log("\n(dry-run — pass `insert` to insert)");
    process.exit(0);
  }

  // Auto-pick the latest platform_profile for (profile, platform) so the
  // inserted task already has credentials wired up. If the user has none
  // configured yet, leave null and the task starts un-credentialed (same
  // outcome as the UI form when the user skips the dropdown).
  const existingCred = await db.query.platform_profiles.findFirst({
    where: and(
      eq(platform_profiles.profile_id, profileId),
      eq(platform_profiles.platform_id, draft.platform_id),
    ),
    orderBy: desc(platform_profiles.date_created),
    columns: { id: true },
  });

  const [created] = await db.insert(search_tasks).values({
    profile_id: profileId,
    platform_id: draft.platform_id,
    platform_profile_id: existingCred?.id ?? null,
    search_term: draft.keywords,
    search_location: null,
    search_filters: draft.filters,
    note: draft.note,
    status: "idle",
    is_active: true,
    login_mode: "auto",
    skip_existing: false,
    keep_minimized: true,
  }).returning({ id: search_tasks.id });

  console.log(
    `\nInserted search_task id=${created.id} for profile ${profileId}` +
      (existingCred
        ? ` (credentials: platform_profile ${existingCred.id})`
        : " (no credentials configured)") +
      ".",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("suggest-task failed:", err);
  process.exit(1);
});
