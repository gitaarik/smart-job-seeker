#!/usr/bin/env node
/**
 * Seed the demo-template account (idempotent).
 *
 * The demo-template is the curated source account whose profile is cloned into
 * every demo user. It's flagged `is_demo_template` so it's never a real login
 * and is excluded from user lists/metrics; provisioning finds it by that flag.
 *
 * Two modes:
 *
 *   # Clone an existing profile on THIS database into the template (no fixture,
 *   # no PII leaves the DB). Run per-environment against a real profile id.
 *   npx vite-node scripts/demo-seed-template.ts -- --from-profile <profileId>
 *
 *   # Or import a committed fixture (portable / synthetic template).
 *   npx vite-node scripts/demo-seed-template.ts
 *
 * Synthetic, non-routable email (welcome/admin emails skip this domain).
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { dbDirect as db } from "$lib/server/db";
import { profiles, users } from "$lib/server/db/schema";
import { auth } from "$lib/server/auth/better-auth";
import { importExportData, importSettings } from "$lib/server/export";
import type { ExportData, SettingsExportData } from "$lib/server/export";
import { cloneProfileInto } from "$lib/server/demo/provision";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, "fixtures", "demo-template.json");

const TEMPLATE_EMAIL = "demo-template@demo.smartjobseeker.local";

interface TemplateFixture {
  version: number;
  profile: ExportData;
  settings: SettingsExportData;
}

/** Parse `--from-profile <id>` / `--from-profile=<id>` from argv. */
function parseFromProfile(): number | null {
  const argv = process.argv.slice(2);
  const i = argv.findIndex((a) =>
    a === "--from-profile" || a.startsWith("--from-profile=")
  );
  if (i < 0) return null;
  const raw = argv[i].includes("=") ? argv[i].split("=")[1] : argv[i + 1];
  const id = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(id)) {
    console.error("--from-profile needs a numeric profile id");
    process.exit(1);
  }
  return id;
}

async function getOrCreateTemplateUser(): Promise<string> {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, TEMPLATE_EMAIL),
    columns: { id: true },
  });
  if (existing) return existing.id;

  const result = await auth.api.signUpEmail({
    body: {
      email: TEMPLATE_EMAIL,
      password: randomBytes(24).toString("hex"),
      name: "Demo Template",
    },
  });
  if (!result.user) throw new Error("Failed to create demo-template user");
  return result.user.id;
}

async function main() {
  const fromProfile = parseFromProfile();

  console.log(`Seeding demo-template account (${TEMPLATE_EMAIL})...`);
  const userId = await getOrCreateTemplateUser();

  // Mark as template; never a real login, excluded from metrics.
  await db.update(users)
    .set({ is_demo_template: true, emailVerified: true })
    .where(eq(users.id, userId));

  // Re-seed idempotently: overwrite the existing template profile if present.
  const existingProfile = await db.query.profiles.findFirst({
    where: eq(profiles.user_id, userId),
    columns: { id: true },
    orderBy: (p, { asc }) => asc(p.id),
  });

  let profileId: number;
  if (fromProfile !== null) {
    // In-DB clone: copy an existing profile straight into the template account.
    console.log(`Cloning profile ${fromProfile} into the template...`);
    profileId = await cloneProfileInto(fromProfile, userId, {
      overwriteProfileId: existingProfile?.id,
    });
  } else {
    // Fixture import (portable / synthetic template).
    const fixture = JSON.parse(
      readFileSync(FIXTURE_PATH, "utf-8"),
    ) as TemplateFixture;
    ({ profileId } = await importExportData(fixture.profile, userId, {
      overwriteProfileId: existingProfile?.id,
    }));
    await importSettings(profileId, userId, fixture.settings, {
      replaceExistingTasks: true,
      applyMatchConfig: true,
      applyEmailDigest: false,
      applySalary: true,
    });
  }

  console.log(`Demo-template ready: profile ${profileId} for user ${userId}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
