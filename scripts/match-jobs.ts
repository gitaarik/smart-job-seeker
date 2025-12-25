#!/usr/bin/env node

/**
 * Job matching script
 * Matches jobs against profile preferences and generates LLM-based match scores
 */

import { dbDirect } from "$lib/db";
import {
  calculateMatch,
  filterEligibleJobs,
  getMatchingPreferences,
  upsertJobMatch,
} from "$lib/server/job-matcher";
import { getProfileSkills, needsRematching } from "$lib/server/job-match-utils";
import { errorTracker } from "$lib/server/monitoring/error-tracker";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface CliArgs {
  profileId: number;
  jobIds?: number[];
  force: boolean;
  batchSize: number;
}

interface MatchStats {
  total: number;
  matched: number;
  updated: number;
  skipped: number;
  failed: number;
}

/**
 * Parse CLI arguments
 */
function parseArgs(): CliArgs | null {
  const args = process.argv.slice(2);

  let profileId: number | undefined;
  let jobIds: number[] | undefined;
  let force = false;
  let batchSize = 10;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--profile-id") {
      profileId = parseInt(args[++i], 10);
    } else if (arg === "--job-ids") {
      jobIds = args[++i].split(",").map((id) => parseInt(id.trim(), 10));
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--batch-size") {
      batchSize = parseInt(args[++i], 10);
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      return null;
    } else {
      console.error(`Unknown argument: ${arg}`);
      printUsage();
      return null;
    }
  }

  if (!profileId) {
    console.error("Error: --profile-id is required");
    printUsage();
    return null;
  }

  return { profileId, jobIds, force, batchSize };
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
Usage: npm run match-jobs -- [options]

Options:
  --profile-id <id>         Profile ID to match jobs for (required)
  --job-ids <ids>          Comma-separated job IDs to match (optional)
  --force                  Force re-match even if unchanged (optional)
  --batch-size <num>       Number of jobs to process concurrently (default: 10)
  --help, -h               Show this help message

Examples:
  # Match all eligible jobs for profile
  npm run match-jobs -- --profile-id=1

  # Match specific jobs
  npm run match-jobs -- --profile-id=1 --job-ids=101,102,103

  # Force re-match all jobs
  npm run match-jobs -- --profile-id=1 --force

  # Control batch size
  npm run match-jobs -- --profile-id=1 --batch-size=5
`);
}

/**
 * Process jobs in batches
 */
async function processBatch(
  jobs: Array<{ id: number; title: string | null; date_updated: Date | null }>,
  collectedDataId: number,
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
      if (!force && !(await needsRematching(collectedDataId, job.id, job))) {
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
        collectedDataId,
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
      console.log(`   Summary: ${matchResult.summary.substring(0, 150)}...`);
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
 * Clear Directus cache
 */
async function clearDirectusCache(): Promise<void> {
  try {
    console.log("\n🧹 Clearing Directus cache...");
    await execAsync("npm run docker:clear-directus-cache");
    console.log("✅ Directus cache cleared");
  } catch (error) {
    console.error(
      "⚠️  Failed to clear Directus cache:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Main matching function
 */
async function matchJobs(): Promise<void> {
  const args = parseArgs();
  if (!args) {
    process.exit(1);
  }

  const { profileId, jobIds, force, batchSize } = args;

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
        collectedData.id,
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
    await clearDirectusCache();
  }
}

// Handle interrupts (Ctrl+C) and termination signals
let isExiting = false;

async function handleExit(signal: string) {
  if (isExiting) return;
  isExiting = true;

  console.log(`\n\n⚠️  Received ${signal}, cleaning up...`);
  await clearDirectusCache();
  process.exit(0);
}

process.on("SIGINT", () => handleExit("SIGINT"));
process.on("SIGTERM", () => handleExit("SIGTERM"));

// Execute
matchJobs().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
