#!/usr/bin/env node
/**
 * One-time script to create dev users and link them to existing profiles.
 * Run this before generating the dev seed.
 */

import { auth } from "$lib/server/auth/better-auth";
import { dbDirect as db } from "$lib/server/db";

const DEV_USERS = [
  {
    email: "rik@rikwanders.tech",
    password: "testpassword123",
    name: "Rik Wanders",
    profileId: 1,
  },
  {
    email: "alex.morgan@example.com",
    password: "testpassword123",
    name: "Alex Morgan",
    profileId: 12,
  },
];

async function seedDevUsers() {
  console.log("Creating dev users and linking to profiles...\n");

  for (const user of DEV_USERS) {
    // Check if profile exists
    const profile = await db.profiles.findUnique({
      where: { id: user.profileId },
    });

    if (!profile) {
      console.error(`Profile ${user.profileId} not found, skipping ${user.email}`);
      continue;
    }

    // Check if user already exists
    const existing = await db.user.findFirst({
      where: { email: user.email },
    });

    let userId: string;

    if (existing) {
      console.log(`User already exists: ${user.email}`);
      userId = existing.id;
    } else {
      // Create user via Better Auth API (handles password hashing)
      console.log(`Creating user: ${user.email}`);
      const ctx = await auth.api.signUpEmail({
        body: {
          email: user.email,
          password: user.password,
          name: user.name,
        },
      });

      if (!ctx.user) {
        console.error(`Failed to create user: ${user.email}`);
        continue;
      }

      userId = ctx.user.id;
      console.log(`  Created with ID: ${userId}`);
    }

    // Link profile to user
    await db.profiles.update({
      where: { id: user.profileId },
      data: { user_id: userId },
    });
    console.log(`  Linked to profile ${user.profileId} (${profile.name})`);
  }

  console.log("\nDev users created:");
  for (const user of DEV_USERS) {
    console.log(`  ${user.email} / ${user.password} -> profile ${user.profileId}`);
  }
}

seedDevUsers()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to seed dev users:", error);
    process.exit(1);
  });
