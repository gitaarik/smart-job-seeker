#!/usr/bin/env node

/**
 * Import a profile from PDF Resume
 * Uses LLM to extract structured data from PDF files
 */

import { Command } from "commander";
import { extractResumeFromPdf } from "./lib/pdf-resume-extractor";
import { createProfileFromResume } from "./lib/resume-importer";
import { getEnv } from "$lib/tools/get-env";


async function importPdfResume(
  filePath: string,
  options: {
    validateOnly?: boolean;
    showExtracted?: boolean;
  },
): Promise<void> {
  try {
    // Check for API key
    const apiKey = getEnv("SJS_LLM_API_KEY_GROQ", "");
    if (!apiKey) {
      console.error(
        "❌ Error: SJS_LLM_API_KEY_GROQ environment variable is required",
      );
      console.error("   Set it in your .env file to use the LLM extraction");
      process.exit(1);
    }

    console.log(`📄 Importing resume from PDF: ${filePath}\n`);

    // Extract structured data from PDF using LLM
    const resumeData = await extractResumeFromPdf(filePath);

    // Show extracted data if requested
    if (options.showExtracted) {
      console.log("📋 Extracted Data:");
      console.log(JSON.stringify(resumeData, null, 2));
      console.log();
    }

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
      console.log(
        "✅ Extraction and validation complete (--validate-only mode)",
      );
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

  } catch (error) {
    console.error("\n❌ Error importing PDF resume:");
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
  .name("import-from-pdf-resume")
  .description("Import a profile from a PDF resume using LLM extraction")
  .version("1.0.0")
  .argument("<file-path>", "Path to the PDF resume file")
  .option("--validate-only", "Extract and validate without importing", false)
  .option("--show-extracted", "Display extracted JSON data", false)
  .helpOption("-h, --help", "Display help for command")
  .addHelpText(
    "after",
    `
Examples:
  Import a PDF resume:
    npm run host:import-pdf-resume ./my-resume.pdf
    npm run docker:import-pdf-resume ./my-resume.pdf

  Preview extraction without importing:
    npm run host:import-pdf-resume ./resume.pdf --validate-only

  Show extracted JSON data:
    npm run host:import-pdf-resume ./resume.pdf --show-extracted --validate-only

Requirements:
  - SJS_LLM_API_KEY_GROQ environment variable must be set
  - PDF must be text-based (not scanned images)
  - Best results with standard resume formats

Notes:
  - Uses LLM (Groq) to extract structured data from PDF
  - Quality of extraction depends on PDF formatting
  - Costs money (Groq API usage)
`,
  );

program.parse();

const [filePath] = program.args;
const options = program.opts();

importPdfResume(filePath, options).catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
