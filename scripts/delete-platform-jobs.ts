#!/usr/bin/env node
/**
 * Delete all jobs from a specific job platform
 * Usage: npx tsx scripts/delete-platform-jobs.ts --platform-id <id>
 *        npx tsx scripts/delete-platform-jobs.ts --platform-key <key>
 */

import { dbDirect } from "$lib/db";
import { Command } from "commander";
import * as readline from "readline";

const program = new Command();

program
  .name("delete-platform-jobs")
  .description("Delete all jobs from a specific job platform")
  .option("-i, --platform-id <id>", "Platform ID", parseInt)
  .option(
    "-k, --platform-key <key>",
    "Platform key (e.g., 'linkedin', 'mercor')",
  )
  .option("-y, --yes", "Skip confirmation prompt")
  .helpOption("-h, --help", "Display help for command");

program.parse();
const options = program.opts();

async function confirmAction(message: string): Promise<boolean> {
  if (options.yes) return true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes" || answer.toLowerCase() === "y");
    });
  });
}

async function main() {
  // Validate input
  if (!options.platformId && !options.platformKey) {
    console.error(
      "❌ Error: Must provide either --platform-id or --platform-key",
    );
    process.exit(1);
  }

  if (options.platformId && options.platformKey) {
    console.error(
      "❌ Error: Provide only one of --platform-id or --platform-key",
    );
    process.exit(1);
  }

  // Find the platform
  let platform;

  if (options.platformId) {
    console.log(`🔍 Looking up platform with ID: ${options.platformId}`);
    platform = await dbDirect.job_platforms.findUnique({
      where: { id: options.platformId },
      select: {
        id: true,
        name: true,
        key: true,
        _count: {
          select: { jobs: true },
        },
      },
    });
  } else {
    console.log(`🔍 Looking up platform with key: "${options.platformKey}"`);
    platform = await dbDirect.job_platforms.findUnique({
      where: { key: options.platformKey },
      select: {
        id: true,
        name: true,
        key: true,
        _count: {
          select: { jobs: true },
        },
      },
    });
  }

  if (!platform) {
    console.error(
      `❌ Platform not found: ${options.platformId || options.platformKey}`,
    );
    process.exit(1);
  }

  // Display platform info
  console.log("\n📊 Platform Information:");
  console.log(`   ID: ${platform.id}`);
  console.log(`   Name: ${platform.name}`);
  console.log(`   Key: ${platform.key || "(not set)"}`);
  console.log(`   Total jobs: ${platform._count.jobs}`);

  if (platform._count.jobs === 0) {
    console.log("\nℹ️  No jobs to delete for this platform.");
    return;
  }

  // Confirm deletion
  console.log(
    `\n⚠️  WARNING: This will permanently delete ${platform._count.jobs} job(s)!`,
  );

  const confirmed = await confirmAction(
    `Are you sure you want to delete all ${platform._count.jobs} jobs from "${platform.name}"?`,
  );

  if (!confirmed) {
    console.log("\n❌ Deletion cancelled.");
    return;
  }

  // Delete jobs
  console.log(`\n🗑️  Deleting ${platform._count.jobs} job(s)...`);

  const result = await dbDirect.jobs.deleteMany({
    where: {
      job_platform: platform.id,
    },
  });

  console.log(
    `✅ Successfully deleted ${result.count} job(s) from "${platform.name}"`,
  );
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
