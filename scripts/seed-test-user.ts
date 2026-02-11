#!/usr/bin/env node

import { auth } from "$lib/server/auth/better-auth";
import { dbDirect as db } from "$lib/server/db";
import { execFileSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const TEST_EMAIL = "alex.morgan@example.com";
const TEST_PASSWORD = "testpassword123";
const TEST_NAME = "Alex Morgan";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, "fixtures", "alex-morgan-profile.json");

async function seedTestUser() {
  console.log("Seeding test user with Alex Morgan profile...\n");

  // Check if test user already exists
  const existing = await db.user.findFirst({
    where: { email: TEST_EMAIL },
  });

  let userId: string;

  if (existing) {
    console.log(`Test user already exists: ${TEST_EMAIL}`);
    userId = existing.id;

    // Check if user already has a profile
    const existingProfile = await db.profiles.findFirst({
      where: { user_id: userId },
    });

    if (existingProfile) {
      console.log(`User already has profile: ${existingProfile.name} (ID ${existingProfile.id})`);
      console.log("\nTest credentials:");
      console.log(`  Email: ${TEST_EMAIL}`);
      console.log(`  Password: ${TEST_PASSWORD}`);
      return;
    }
  } else {
    // Create user via Better Auth API (handles password hashing)
    console.log(`Creating test user: ${TEST_EMAIL}`);
    const ctx = await auth.api.signUpEmail({
      body: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: TEST_NAME,
      },
    });

    if (!ctx.user) {
      console.error("Failed to create test user");
      process.exit(1);
    }

    console.log(`Test user created: ${ctx.user.email}`);
    userId = ctx.user.id;
  }

  // Import the Alex Morgan profile from fixture and link to user
  console.log(`\nImporting profile from fixture...`);
  console.log(`Fixture: ${FIXTURE_PATH}`);

  try {
    execFileSync("npx", [
      "vite-node",
      "scripts/import-profile.ts",
      FIXTURE_PATH,
      "--user-id",
      userId,
    ], {
      stdio: "inherit",
      cwd: join(__dirname, ".."),
    });
  } catch (error) {
    console.error("Failed to import profile:", error);
    process.exit(1);
  }

  console.log("\nTest credentials:");
  console.log(`  Email: ${TEST_EMAIL}`);
  console.log(`  Password: ${TEST_PASSWORD}`);
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
