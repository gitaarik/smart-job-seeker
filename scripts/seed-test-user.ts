#!/usr/bin/env node

import { auth } from "$lib/server/auth/better-auth";
import { dbDirect as db } from "$lib/server/db";

const TEST_EMAIL = "alex.morgan@example.com";
const TEST_PASSWORD = "testpassword123";
const TEST_NAME = "Alex Morgan";
const ALEX_MORGAN_PROFILE_ID = 12;

async function seedTestUser() {
  console.log("Seeding test user for Alex Morgan profile...");

  // Check if Alex Morgan profile exists
  const alexProfile = await db.profiles.findUnique({
    where: { id: ALEX_MORGAN_PROFILE_ID },
  });

  if (!alexProfile) {
    console.error(`Alex Morgan profile (ID ${ALEX_MORGAN_PROFILE_ID}) not found!`);
    console.error("Make sure the profile exists before running this script.");
    process.exit(1);
  }

  console.log(`Found Alex Morgan profile: ${alexProfile.name}`);

  // Check if test user exists
  const existing = await db.user.findFirst({
    where: { email: TEST_EMAIL },
  });

  let userId: string;

  if (existing) {
    console.log(`Test user already exists: ${TEST_EMAIL}`);
    userId = existing.id;
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

  // Link the Alex Morgan profile to this user
  if (alexProfile.user_id === userId) {
    console.log("Alex Morgan profile is already linked to test user.");
  } else {
    await db.profiles.update({
      where: { id: ALEX_MORGAN_PROFILE_ID },
      data: { user_id: userId },
    });
    console.log(`Linked Alex Morgan profile to test user.`);
  }

  console.log("");
  console.log("Test credentials:");
  console.log(`  Email: ${TEST_EMAIL}`);
  console.log(`  Password: ${TEST_PASSWORD}`);
  console.log(`  Profile: Alex Morgan (ID ${ALEX_MORGAN_PROFILE_ID})`);
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
