#!/usr/bin/env npx tsx
/**
 * Create System Scraper Profile
 *
 * Creates a dedicated "System Job Scraper" profile for background
 * job scraping operations that don't belong to a specific user.
 *
 * Usage:
 *   npx tsx scripts/create-system-scraper-profile.ts
 *
 * The script will:
 * 1. Check if system profile already exists
 * 2. Create profile if it doesn't exist
 * 3. Output the profile ID to add to .env
 */

import { db } from "$lib/db";

const SYSTEM_SCRAPER_EMAIL = "system-scraper@smart-job-seeker.local";
const SYSTEM_SCRAPER_NAME = "System Job Scraper";

async function main() {
  console.log("🔍 Checking for existing system scraper profile...");

  // Check if profile already exists
  const existingProfile = await db.profiles.findFirst({
    where: {
      email_address: SYSTEM_SCRAPER_EMAIL,
    },
  });

  if (existingProfile) {
    console.log("✅ System scraper profile already exists!");
    console.log(`   Profile ID: ${existingProfile.id}`);
    console.log(`   Name: ${existingProfile.name || "(no name)"}`);
    console.log(`   Email: ${existingProfile.email_address || "(no email)"}`);
    console.log("");
    console.log("📝 Add this to your .env file:");
    console.log(`   SJS_SYSTEM_SCRAPER_PROFILE_ID=${existingProfile.id}`);
    return;
  }

  console.log("⚙️  Creating system scraper profile...");

  // Create new profile
  const profile = await db.profiles.create({
    data: {
      name: SYSTEM_SCRAPER_NAME,
      email_address: SYSTEM_SCRAPER_EMAIL,
      date_created: new Date(),
      date_updated: new Date(),
    },
  });

  console.log("✅ System scraper profile created successfully!");
  console.log(`   Profile ID: ${profile.id}`);
  console.log(`   Name: ${profile.name || "(no name)"}`);
  console.log(`   Email: ${profile.email_address || "(no email)"}`);
  console.log("");
  console.log("📝 Add this to your .env file:");
  console.log(`   SJS_SYSTEM_SCRAPER_PROFILE_ID=${profile.id}`);
  console.log("");
  console.log("⚠️  Remember to:");
  console.log("   1. Add the environment variable to .env");
  console.log("   2. Restart your application to pick up the new config");
}

main()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
