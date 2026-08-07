#!/usr/bin/env node
/**
 * Create the Alex Morgan test user and profile, for local development and the
 * Playwright MCP flows documented in AGENTS.md.
 *
 * Idempotent: an existing user is reused, and an existing profile is left
 * alone rather than duplicated.
 *
 *   docker compose exec app node dist-scripts/seed-test-user.mjs
 */

import { auth } from "$lib/server/auth/better-auth";
import { dbDirect as db } from "$lib/server/db";
import { profiles, users } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { importProfileFromJson } from "$lib/server/profile/import-profile-json";
import type { ExportedProfile } from "$lib/server/profile/export-profile-json";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const TEST_EMAIL = "alex.morgan@example.com";
const TEST_PASSWORD = "testpassword123";
const TEST_NAME = "Alex Morgan";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, "fixtures", "alex-morgan-profile.json");

function printCredentials() {
  console.log("\nTest credentials:");
  console.log(`  Email: ${TEST_EMAIL}`);
  console.log(`  Password: ${TEST_PASSWORD}`);
}

async function seedTestUser() {
  console.log("Seeding test user with Alex Morgan profile...\n");

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, TEST_EMAIL))
    .limit(1);

  let userId: string;

  if (existing) {
    console.log(`Test user already exists: ${TEST_EMAIL}`);
    userId = existing.id;

    const [existingProfile] = await db
      .select({ id: profiles.id, name: profiles.name })
      .from(profiles)
      .where(eq(profiles.user_id, userId))
      .limit(1);

    if (existingProfile) {
      console.log(
        `User already has profile: ${existingProfile.name} (ID ${existingProfile.id})`,
      );
      printCredentials();
      return;
    }
  } else {
    // Better Auth owns password hashing — go through its API rather than
    // inserting into `users` directly.
    console.log(`Creating test user: ${TEST_EMAIL}`);
    const ctx = await auth.api.signUpEmail({
      body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME },
    });

    if (!ctx.user) {
      console.error("Failed to create test user");
      process.exit(1);
    }

    console.log(`Test user created: ${ctx.user.email}`);
    userId = ctx.user.id;
  }

  // This used to shell out to `npx vite-node scripts/import-profile.ts`, a
  // Prisma-era script that has since been deleted — the app's own importer
  // does the same job and is the one the profile-import UI uses.
  console.log(`\nImporting profile from fixture…`);
  console.log(`Fixture: ${FIXTURE_PATH}`);

  const data = JSON.parse(
    readFileSync(FIXTURE_PATH, "utf8"),
  ) as ExportedProfile;

  const result = await importProfileFromJson(data, userId);
  console.log(`Imported profile: ${result.profileName} (ID ${result.profileId})`);

  printCredentials();
}

seedTestUser()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to seed test user:", error);
    process.exit(1);
  });
