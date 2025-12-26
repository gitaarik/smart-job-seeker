#!/usr/bin/env node

/**
 * Import a profile from JSON Resume format
 * Follows the JSON Resume schema standard (https://jsonresume.org)
 */

import { readFileSync } from "fs";
import { Command } from "commander";
import {
  mapJsonResumeToInternal,
  validateJsonResume,
} from "./lib/json-resume-mapper";
import { createProfileFromResume } from "./lib/resume-importer";
import { clearDirectusCache } from "$lib/server/directus";

async function importJsonResume(
  filePath: string,
  options: {
    validateOnly?: boolean;
    noSkills?: boolean;
    noProjects?: boolean;
  },
): Promise<void> {
  try {
    console.log(`📄 Reading JSON Resume from: ${filePath}\n`);

    // Read and parse the JSON file
    const fileContent = readFileSync(filePath, "utf-8");
    const jsonResume = JSON.parse(fileContent);

    // Validate JSON Resume schema
    console.log("🔍 Validating JSON Resume format...");
    validateJsonResume(jsonResume);
    console.log("✅ JSON Resume format is valid\n");

    // Map to internal format
    console.log("🔄 Converting to internal format...");
    const resumeData = await mapJsonResumeToInternal(jsonResume);

    // Apply filters based on options
    if (options.noSkills) {
      console.log("⏭️  Skipping skills (--no-skills flag)");
      resumeData.skills = [];
    }
    if (options.noProjects) {
      console.log("⏭️  Skipping projects (--no-projects flag)");
      resumeData.projects = [];
    }

    console.log("✅ Conversion complete\n");

    // Show preview
    console.log("📋 Preview:");
    console.log(`   Name: ${resumeData.basics.name}`);
    console.log(`   Title: ${resumeData.basics.title || "N/A"}`);
    console.log(`   Email: ${resumeData.basics.email || "N/A"}`);
    console.log(`   Location: ${resumeData.basics.location || "N/A"}`);
    console.log(`   Work experiences: ${resumeData.work?.length || 0}`);
    console.log(`   Education: ${resumeData.education?.length || 0}`);
    console.log(`   Skill categories: ${resumeData.skills?.length || 0}`);
    console.log(`   Languages: ${resumeData.languages?.length || 0}`);
    console.log(`   Projects: ${resumeData.projects?.length || 0}`);
    console.log(`   References: ${resumeData.references?.length || 0}`);
    console.log();

    if (options.validateOnly) {
      console.log("✅ Validation complete (--validate-only mode)");
      console.log("   No profile was created in the database.");
      return;
    }

    // Import into database
    console.log("💾 Importing profile to database...\n");
    const result = await createProfileFromResume(resumeData);

    if (!result.success) {
      console.error("\n❌ Import failed:");
      if (result.errors) {
        result.errors.forEach((error) => console.error(`   - ${error}`));
      } else {
        console.error(`   ${result.message}`);
      }
      process.exit(1);
    }

    console.log(`\n🎉 Success! Profile ID: ${result.profileId}`);

    // Clear Directus cache
    console.log("\n🔄 Clearing Directus cache...");
    await clearDirectusCache();
    console.log("✅ Directus cache cleared");
  } catch (error) {
    console.error("\n❌ Error importing JSON Resume:");
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    } else {
      console.error(`   ${String(error)}`);
    }
    process.exit(1);
  }
}

// CLI Program
const program = new Command();

program
  .name("import-from-json-resume")
  .description("Import a profile from JSON Resume format (jsonresume.org)")
  .version("1.0.0")
  .argument("<file-path>", "Path to the JSON Resume file")
  .option("--validate-only", "Validate and preview without importing", false)
  .option("--no-skills", "Skip importing skills section")
  .option("--no-projects", "Skip importing projects section")
  .helpOption("-h, --help", "Display help for command")
  .addHelpText(
    "after",
    `
Examples:
  Import a JSON Resume:
    npm run host:import-json-resume ./resume.json
    npm run docker:import-json-resume ./resume.json

  Validate without importing:
    npm run host:import-json-resume ./resume.json --validate-only

  Skip certain sections:
    npm run host:import-json-resume ./resume.json --no-skills
    npm run host:import-json-resume ./resume.json --no-projects

JSON Resume Format:
  This tool expects files following the JSON Resume schema:
  https://jsonresume.org/schema/

  Minimum required fields:
  {
    "basics": {
      "name": "Your Name"
    }
  }
`,
  );

program.parse();

const [filePath] = program.args;
const options = program.opts();

importJsonResume(filePath, options).catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
