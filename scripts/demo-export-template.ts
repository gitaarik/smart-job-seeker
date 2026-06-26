#!/usr/bin/env node
/**
 * Export a profile to the demo-template fixture (template-as-code).
 *
 * Author the template visually under any account on dev, then run this with the
 * profile id to snapshot its profile + search tasks into a committed fixture.
 * `demo-seed-template.ts` recreates it on any environment.
 *
 * Usage (from cloud/oss/):
 *   npx vite-node scripts/demo-export-template.ts -- <profileId>
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { buildProfileExport, buildSettingsExport } from "$lib/server/export";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, "fixtures", "demo-template.json");

async function main() {
  const arg = process.argv[2];
  const profileId = arg ? parseInt(arg, 10) : NaN;
  if (!Number.isFinite(profileId)) {
    console.error(
      "Usage: npx vite-node scripts/demo-export-template.ts -- <profileId>",
    );
    process.exit(1);
  }

  console.log(`Exporting profile ${profileId} → demo-template fixture...`);
  const { data: profile } = await buildProfileExport(profileId);
  const settings = await buildSettingsExport(profileId);

  const fixture = { version: 1, profile, settings };
  mkdirSync(dirname(FIXTURE_PATH), { recursive: true });
  writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2));
  console.log(`Wrote ${FIXTURE_PATH}`);
  console.log(
    `  ${settings.search_tasks?.length ?? 0} search task(s) captured.`,
  );
  console.log("Commit the fixture, then run demo-seed-template on the target env.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Export failed:", err);
    process.exit(1);
  });
