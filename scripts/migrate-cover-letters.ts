/**
 * Migration script to convert existing cover letters from applications to application_letters
 *
 * This script:
 * 1. Finds all applications with cover_letter or cover_letter_ai_chat
 * 2. Creates application_letter records with letter_type='cover_letter'
 * 3. Copies the content and ai_chat references
 * 4. Preserves timestamps from the original application
 */

import { db } from "../src/lib/db";

async function migrateCoverLetters() {
  console.log("Starting cover letter migration...");

  // Find all applications with cover letters
  const applicationsWithCoverLetters = await db.applications.findMany({
    where: {
      OR: [
        { cover_letter: { not: null } },
        { cover_letter_ai_chat: { not: null } },
      ],
    },
    select: {
      id: true,
      cover_letter: true,
      cover_letter_ai_chat: true,
      date_created: true,
      date_updated: true,
    },
  });

  console.log(
    `Found ${applicationsWithCoverLetters.length} applications with cover letters`,
  );

  if (applicationsWithCoverLetters.length === 0) {
    console.log("No cover letters to migrate.");
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const application of applicationsWithCoverLetters) {
    try {
      // Check if a letter already exists for this application
      const existingLetter = await db.application_letters.findFirst({
        where: {
          application: application.id,
          letter_type: "cover_letter",
        },
      });

      if (existingLetter) {
        console.log(
          `  Skipping application ${application.id} - letter already exists`,
        );
        continue;
      }

      // Create the application_letter record
      await db.application_letters.create({
        data: {
          application: application.id,
          letter_type: "cover_letter",
          status: "draft",
          content: application.cover_letter || null,
          ai_chat: application.cover_letter_ai_chat || null,
          date_created: application.date_created || new Date(),
          date_updated: application.date_updated || new Date(),
        },
      });

      successCount++;
      console.log(
        `  ✓ Migrated cover letter for application ${application.id}`,
      );
    } catch (error) {
      errorCount++;
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      console.error(
        `  ✗ Failed to migrate application ${application.id}: ${errorMessage}`,
      );
    }
  }

  console.log("\nMigration complete!");
  console.log(`  Successful: ${successCount}`);
  console.log(`  Failed: ${errorCount}`);
  console.log(
    `  Skipped: ${
      applicationsWithCoverLetters.length - successCount - errorCount
    }`,
  );
}

// Run the migration
migrateCoverLetters()
  .then(() => {
    console.log("\nMigration finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nMigration failed with error:", error);
    process.exit(1);
  });
