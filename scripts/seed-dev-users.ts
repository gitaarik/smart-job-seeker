#!/usr/bin/env node
/**
 * Create the dev users and link them to existing profiles. Run before
 * generating the dev seed (see create-dev-seed).
 *
 * Idempotent: existing users are reused; the profile link is re-applied either
 * way, so a re-run repairs a broken link rather than duplicating anything.
 *
 *   docker compose exec app node dist-scripts/seed-dev-users.mjs
 *
 * Passwords come from the environment where set. The defaults are development
 * values that have been in this repo's public history since 2026-02, so treat
 * them as known: they are fine for a throwaway local database and must never be
 * reused anywhere that matters.
 */

import { auth } from "$lib/server/auth/better-auth";
import { dbDirect as db } from "$lib/server/db";
import { profiles, users } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";

const DEV_USERS = [
  {
    email: "rik@rikwanders.tech",
    password: process.env.SJS_DEV_SEED_PASSWORD ?? "waterpijp",
    name: "Rik Wanders",
    profileId: 1,
  },
  {
    email: "alex.morgan@example.com",
    password: process.env.SJS_TEST_USER_PASSWORD ?? "testpassword123",
    name: "Alex Morgan",
    profileId: 12,
  },
];

async function seedDevUsers() {
  console.log("Creating dev users and linking to profiles...\n");

  for (const user of DEV_USERS) {
    const [profile] = await db
      .select({ id: profiles.id, name: profiles.name })
      .from(profiles)
      .where(eq(profiles.id, user.profileId))
      .limit(1);

    if (!profile) {
      console.error(
        `Profile ${user.profileId} not found, skipping ${user.email}`,
      );
      continue;
    }

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, user.email))
      .limit(1);

    let userId: string;

    if (existing) {
      console.log(`User already exists: ${user.email}`);
      userId = existing.id;
    } else {
      // Better Auth owns password hashing — go through its API rather than
      // inserting into `users` directly.
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

    await db
      .update(profiles)
      .set({ user_id: userId })
      .where(eq(profiles.id, user.profileId));
    console.log(`  Linked to profile ${user.profileId} (${profile.name})`);
  }

  console.log("\nDev users created:");
  for (const user of DEV_USERS) {
    console.log(`  ${user.email} -> profile ${user.profileId}`);
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
