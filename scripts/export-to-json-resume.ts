#!/usr/bin/env node

/**
 * Export a profile to JSON Resume format
 *
 * Usage:
 *   npm run docker:export-to-json-resume <profileId> [outputPath]
 *
 * Examples:
 *   npm run docker:export-to-json-resume 12
 *   npm run docker:export-to-json-resume 12 ./custom-resume.json
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { dbDirect } from "../src/lib/db";
import { getDefaultProfileId } from "../src/lib/server/profile-default";
import { createProfileExport } from "../src/lib/server/profile-exports";
import { buildExportUrl } from "../src/lib/server/export-url-builder";
import { exportProfileToJsonResume } from "./lib/json-resume-exporter";

async function main() {
  const args = process.argv.slice(2);

  let profileId: number;
  let exportToFile: boolean;

  if (args.length === 0 || !args[0]) {
    // No profile ID provided, use default and export to file
    const defaultId = await getDefaultProfileId();
    if (!defaultId) {
      console.error(
        "❌ Error: No profile ID provided and no default profile is set",
      );
      console.error("\nUsage:");
      console.error(
        "  npm run docker:export-to-json-resume [profileId] [outputPath]",
      );
      console.error("\nExamples:");
      console.error("  npm run docker:export-to-json-resume");
      console.error("  npm run docker:export-to-json-resume 12");
      console.error(
        "  npm run docker:export-to-json-resume 12 ./custom-resume.json",
      );
      console.error(
        "\nSet a default profile or provide a profile ID",
      );
      process.exit(1);
    }
    profileId = defaultId;
    exportToFile = true;
    console.log(`Using default profile: ${profileId}`);
  } else {
    // Profile ID provided as argument - only save to database
    profileId = parseInt(args[0], 10);
    if (isNaN(profileId)) {
      console.error(`❌ Error: Invalid profile ID "${args[0]}"`);
      console.error("Profile ID must be a number");
      process.exit(1);
    }
    exportToFile = false;
  }

  const outputPath = args[1] || `./exports/resume-${profileId}.json`;

  console.log(`🔄 Exporting profile ${profileId} to JSON Resume format...\n`);

  // Query full profile data with all relations
  const profile = await dbDirect.profiles.findUnique({
    where: { id: profileId },
    select: {
      // Basic fields
      name: true,
      title: true,
      email_address: true,
      phone_number: true,
      personal_website: true,
      summary: true,
      location: true,
      linkedin_profile: true,
      github_profile: true,
      stackoverflow_profile: true,

      // Relations with nested data
      work_experiences: {
        select: {
          name: true,
          position: true,
          location: true,
          website: true,
          start_date: true,
          end_date: true,
          summary: true,
          description: true,
          work_experience_achievements: {
            select: { description: true },
            orderBy: { sort: "asc" },
          },
          work_experience_technologies: {
            select: { name: true },
            orderBy: { sort: "asc" },
          },
        },
        orderBy: { sort: "asc" },
      },

      education: {
        select: {
          institution: true,
          url: true,
          area: true,
          study_type: true,
          start_date: true,
          end_date: true,
          graduation_year: true,
        },
        orderBy: { sort: "asc" },
      },

      tech_skill_categories: {
        select: {
          name: true,
          tech_skills: {
            select: { name: true, level: true },
            orderBy: { sort: "asc" },
          },
        },
        orderBy: { sort: "asc" },
      },

      languages: {
        select: { name: true, proficiency: true },
        orderBy: { sort: "asc" },
      },

      side_projects: {
        select: {
          name: true,
          url: true,
          summary: true,
          start_date: true,
          end_date: true,
          stars: true,
          side_project_achievements: {
            select: { description: true },
            orderBy: { sort: "asc" },
          },
          side_project_technologies: {
            select: { name: true },
            orderBy: { sort: "asc" },
          },
        },
        orderBy: { sort: "asc" },
      },

      references: {
        select: { author: true, text: true },
        orderBy: { sort: "asc" },
      },
    },
  });

  if (!profile) {
    console.error(`❌ Error: Profile with ID ${profileId} not found`);
    process.exit(1);
  }

  console.log(`✅ Found profile: ${profile.name}\n`);

  // Export to JSON Resume format
  const jsonResume = exportProfileToJsonResume(profile);

  // Conditionally export to file
  if (exportToFile) {
    // Ensure output directory exists
    mkdirSync(dirname(outputPath), { recursive: true });

    // Write to file
    writeFileSync(outputPath, JSON.stringify(jsonResume, null, 2), "utf-8");
    console.log(`📁 File: ${outputPath}`);
  }

  // Save to profile_exports collection
  try {
    // Create buffer from JSON data
    const jsonString = JSON.stringify(jsonResume, null, 2);
    const buffer = Buffer.from(jsonString, "utf-8");

    // Build source URL for the JSON Resume route
    const sourceUrl = buildExportUrl({
      route: "resume.json",
    });

    await createProfileExport({
      profileId,
      fileBuffer: buffer,
      filename: `resume-${profileId}.json`,
      fileType: "json",
      exportType: "structured_data",
      exportFormat: "json_resume",
      description: `JSON Resume format export for profile ${profileId}`,
      sourceUrl: sourceUrl,
    });
    console.log(`✅ Export saved to profile_exports collection`);
  } catch (error) {
    console.error(
      `❌ Failed to save to database: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    if (!exportToFile) {
      // If we didn't export to file and DB save failed, this is a failure
      throw error;
    }
    // If we exported to file, continue with success message
  }

  console.log(`✅ JSON Resume successfully exported\n`);

  // Print summary statistics
  console.log("📊 Export Summary:");
  console.log(`   Name:             ${jsonResume.basics?.name || "N/A"}`);
  console.log(
    `   Title:            ${jsonResume.basics?.label || "N/A"}`,
  );
  console.log(
    `   Work Experiences: ${jsonResume.work?.length || 0}`,
  );
  console.log(
    `   Education:        ${jsonResume.education?.length || 0}`,
  );
  console.log(
    `   Skill Categories: ${jsonResume.skills?.length || 0}`,
  );
  console.log(
    `   Languages:        ${jsonResume.languages?.length || 0}`,
  );
  console.log(
    `   Projects:         ${jsonResume.projects?.length || 0}`,
  );
  console.log(
    `   References:       ${jsonResume.references?.length || 0}`,
  );

  // Count total skills
  const totalSkills = jsonResume.skills?.reduce(
    (sum, cat) => sum + (cat.keywords?.length || 0),
    0,
  ) || 0;
  console.log(`   Total Skills:     ${totalSkills}\n`);

  console.log("✨ Done!\n");
}

main()
  .catch((error) => {
    console.error("❌ Export failed:", error);
    process.exit(1);
  })
  .finally(() => {
    dbDirect.$disconnect();
  });
