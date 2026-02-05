#!/usr/bin/env node

/**
 * Job matching script
 * Matches jobs against profile preferences and generates LLM-based match scores
 */

import { dbDirect } from "$lib/server/db";
import {
  calculateMatch,
  filterEligibleJobs,
  getMatchingPreferences,
  upsertJobMatch,
} from "$lib/server/job/matcher";
import { getProfileSkills, needsRematching } from "$lib/server/job/match-utils";
import { errorTracker } from "$lib/server/monitoring/error-tracker";
import { clearDirectusCache } from "$lib/server/directus/client";
import { getDefaultProfileId } from "$lib/server/profile/default";
import { Command } from "commander";

interface MatchStats {
  total: number;
  matched: number;
  updated: number;
  skipped: number;
  failed: number;
}

// CLI Program
const program = new Command();

program
  .name("match-jobs")
  .description(
    "Match jobs against profile preferences and generate LLM-based match scores",
  )
  .version("1.0.0")
  .option(
    "-p, --profile-id <id>",
    "Profile ID to match jobs for (defaults to default profile)",
    parseInt,
  )
  .option(
    "-j, --job-ids <ids>",
    "Comma-separated job IDs to match",
    (value) => value.split(",").map((id) => parseInt(id.trim(), 10)),
  )
  .option("-f, --force", "Force re-match even if unchanged", false)
  .option(
    "-b, --batch-size <num>",
    "Number of jobs to process concurrently",
    parseInt,
    10,
  )
  .helpOption("-h, --help", "Display help for command");

program.parse();
const options = program.opts();

/**
 * Process jobs in batches
 */
async function processBatch(
  jobs: Array<{ id: number; title: string | null; date_updated: Date | null }>,
  profileId: number,
  preferences: any,
  force: boolean,
): Promise<MatchStats> {
  const stats: MatchStats = {
    total: jobs.length,
    matched: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const job of jobs) {
    try {
      // Check if job needs re-matching
      if (!force && !(await needsRematching(profileId, job.id, job))) {
        console.log(
          `⏭️  Skipping job #${job.id} (${
            job.title || "Untitled"
          }) - already matched and unchanged`,
        );
        stats.skipped++;
        continue;
      }

      console.log(
        `\n🔍 Matching job #${job.id} (${job.title || "Untitled"})...`,
      );

      // Calculate match score using LLM
      const matchResult = await calculateMatch(
        profileId,
        job,
        preferences,
      );

      // Save match result
      const { created } = await upsertJobMatch(matchResult);

      if (created) {
        console.log(
          `✅ Created match for job #${job.id} - Score: ${matchResult.score}/100 (${matchResult.recommendation})`,
        );
        stats.matched++;
      } else {
        console.log(
          `🔄 Updated match for job #${job.id} - Score: ${matchResult.score}/100 (${matchResult.recommendation})`,
        );
        stats.updated++;
      }

      // Show match summary
      console.log(
        `   Reasoning: ${matchResult.reasoning.substring(0, 150)}...`,
      );
      console.log(`   Skills: ${matchResult.skill_match_percentage}%`);
      console.log(
        `   Strengths: ${matchResult.strengths.slice(0, 2).join(", ")}`,
      );
    } catch (error) {
      console.error(
        `❌ Failed to match job #${job.id}:`,
        error instanceof Error ? error.message : String(error),
      );

      errorTracker.logError(
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: "matchJob",
          metadata: { jobId: job.id },
        },
      );

      stats.failed++;
      // Continue with next job
    }
  }

  return stats;
}

/**
 * Main matching function
 */
async function matchJobs(): Promise<void> {
  let { profileId } = options;
  const { jobIds, force, batchSize } = options;

  // Get profile ID from option or default
  if (!profileId) {
    profileId = await getDefaultProfileId();
    if (!profileId) {
      console.error(
        "❌ Error: No profile ID provided and no default profile is set",
      );
      console.error(
        "\nSet a default profile in Directus or provide --profile-id",
      );
      process.exit(1);
    }
    console.log(`Using default profile: ${profileId}`);
  }

  // Validate profile ID
  if (isNaN(profileId)) {
    console.error("❌ Invalid profile ID: must be a number");
    process.exit(1);
  }

  try {
    console.log("========================================");
    console.log(`Job Matching for Profile #${profileId}`);
    console.log("========================================\n");

    // 1. Get matching preferences
    console.log("📋 Fetching matching preferences...");
    const preferences = await getMatchingPreferences(profileId);

    if (!preferences) {
      console.error(
        `❌ No matching preferences found for profile #${profileId}`,
      );
      console.log(
        "\n💡 Tip: Create job matching preferences in Directus for this profile",
      );
      process.exit(1);
    }

    console.log("✅ Preferences loaded:");
    console.log(`   Job types: ${preferences.job_types?.join(", ") || "Any"}`);
    console.log(
      `   Remote options: ${preferences.remote_options?.join(", ") || "Any"}`,
    );
    console.log(
      `   Locations: ${preferences.locations?.join(", ") || "Any"}`,
    );

    // 2. Get collected data for profile
    console.log("\n📦 Fetching collected data...");
    const collectedData = await dbDirect.collected_data.findFirst({
      where: { profile: profileId },
      orderBy: { date_updated: "desc" },
    });

    if (!collectedData) {
      console.error(
        `❌ No collected data found for profile #${profileId}`,
      );
      console.log(
        "\n💡 Tip: Export the profile using the 'Export Profile' button in Directus",
      );
      process.exit(1);
    }

    console.log(`✅ Using collected data #${collectedData.id}`);

    // 3. Extract profile skills
    console.log("\n🔧 Extracting profile skills...");
    const profileSkills = await getProfileSkills(profileId);

    if (profileSkills.length === 0) {
      console.error(
        `❌ No skills found for profile #${profileId}`,
      );
      console.log(
        "\n💡 Tip: Add tech skills to the profile in Directus",
      );
      process.exit(1);
    }

    console.log(
      `✅ Found ${profileSkills.length} skills: ${
        profileSkills.slice(0, 5).join(", ")
      }${profileSkills.length > 5 ? "..." : ""}`,
    );

    // 4. Filter eligible jobs
    console.log("\n🔎 Filtering eligible jobs...");
    const eligibleJobs = await filterEligibleJobs(
      preferences,
      profileSkills,
      jobIds,
    );

    if (eligibleJobs.length === 0) {
      console.log("ℹ️  No eligible jobs found matching the criteria");
      process.exit(0);
    }

    console.log(`✅ Found ${eligibleJobs.length} eligible job(s)\n`);

    // 5. Process jobs in batches
    const allStats: MatchStats = {
      total: 0,
      matched: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };

    // Process jobs sequentially to avoid rate limiting
    for (let i = 0; i < eligibleJobs.length; i += batchSize) {
      const batch = eligibleJobs.slice(i, i + batchSize);
      console.log(
        `\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${
          Math.ceil(eligibleJobs.length / batchSize)
        } (${batch.length} jobs)...`,
      );

      const batchStats = await processBatch(
        batch,
        profileId,
        preferences,
        force,
      );

      // Aggregate stats
      allStats.total += batchStats.total;
      allStats.matched += batchStats.matched;
      allStats.updated += batchStats.updated;
      allStats.skipped += batchStats.skipped;
      allStats.failed += batchStats.failed;

      // Delay between batches to avoid rate limiting
      if (i + batchSize < eligibleJobs.length) {
        console.log("\n⏳ Waiting 2 seconds before next batch...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // 6. Print summary
    console.log("\n\n========================================");
    console.log("📊 Matching Summary");
    console.log("========================================");
    console.log(`Total jobs processed: ${allStats.total}`);
    console.log(`✅ New matches created: ${allStats.matched}`);
    console.log(`🔄 Existing matches updated: ${allStats.updated}`);
    console.log(`⏭️  Jobs skipped (unchanged): ${allStats.skipped}`);
    console.log(`❌ Failed: ${allStats.failed}`);
    console.log("========================================\n");

    if (allStats.failed > 0) {
      console.log(
        "⚠️  Some jobs failed to match. Check the logs above for details.",
      );
    }

    console.log("✅ Job matching completed successfully!");
  } catch (error) {
    console.error(
      "❌ Job matching failed:",
      error instanceof Error ? error.message : String(error),
    );

    errorTracker.logError(
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: "matchJobs",
        metadata: { profileId },
      },
    );

    process.exit(1);
  } finally {
    try {
      console.log("\n🧹 Clearing Directus cache...");
      await clearDirectusCache();
      console.log("✅ Directus cache cleared");
    } catch (error) {
      console.error(
        "⚠️  Failed to clear Directus cache:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

// Handle interrupts (Ctrl+C) and termination signals
let isExiting = false;

async function handleExit(signal: string) {
  if (isExiting) return;
  isExiting = true;

  console.log(`\n\n⚠️  Received ${signal}, cleaning up...`);
  try {
    await clearDirectusCache();
    console.log("✅ Directus cache cleared");
  } catch (error) {
    console.error(
      "⚠️  Failed to clear Directus cache:",
      error instanceof Error ? error.message : String(error),
    );
  }
  process.exit(0);
}

process.on("SIGINT", () => handleExit("SIGINT"));
process.on("SIGTERM", () => handleExit("SIGTERM"));

// Execute
matchJobs().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
