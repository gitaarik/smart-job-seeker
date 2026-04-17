#!/usr/bin/env node

import { getDefaultProfileId } from "$lib/server/profile/default";
import { createProfileExport } from "$lib/server/profile/exports";
import { buildProfileJsonExport } from "$lib/server/profile/export-profile-json";
import { buildExportUrl } from "$lib/server/utils/export-url-builder";
import { existsSync, mkdirSync, writeFileSync } from "fs";

async function exportProfile(
  profileId: string,
  exportToFile: boolean = true,
): Promise<void> {
  try {
    console.log(`Exporting profile: ${profileId}`);

    const id = parseInt(profileId, 10);
    const { data: exportData, profileName } =
      await buildProfileJsonExport(id);

    let filename: string | undefined;

    // Conditionally export to file
    if (exportToFile) {
      const outputDir = "./exports";
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      filename = `${outputDir}/${profileName}.json`;

      // Write to file
      writeFileSync(filename, JSON.stringify(exportData, null, 2));
      console.log(`📁 File: ${filename}`);
    }

    // Save to profile_exports collection
    try {
      // Create buffer from export data
      const jsonString = JSON.stringify(exportData, null, 2);
      const buffer = Buffer.from(jsonString, "utf-8");

      // Build source URL for the API route
      const sourceUrl = buildExportUrl({
        route: `api/profile/${id}/export.json`,
      });

      await createProfileExport({
        profileId: id,
        fileBuffer: buffer,
        filename: `${profileName}.json`,
        fileType: "json",
        exportType: "structured_data",
        exportFormat: "profile_json",
        description: `Profile data export for ${profileName}`,
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

    console.log(`✅ Profile exported successfully`);
    console.log(`📊 Exported data summary:`);
    console.log(
      `   - Profile versions: ${exportData.profile.profile_versions.length}`,
    );
    console.log(`   - Highlights: ${exportData.profile.highlights.length}`);
    console.log(
      `   - Tech skill categories: ${exportData.profile.tech_skill_categories.length}`,
    );
    console.log(
      `   - Work experiences: ${exportData.profile.work_experiences.length}`,
    );
    console.log(
      `   - Side projects: ${exportData.profile.side_projects.length}`,
    );
    console.log(`   - Education: ${exportData.profile.education.length}`);
    console.log(`   - Languages: ${exportData.profile.languages.length}`);
    console.log(`   - References: ${exportData.profile.references.length}`);
    console.log(
      `   - Project stories: ${exportData.profile.project_stories.length}`,
    );
    console.log(`   - Cheat sheets: ${exportData.profile.cheat_sheets.length}`);
  } catch (error) {
    console.error("Error exporting profile:", error);
    process.exit(1);
  }
}

// Main execution
async function main() {
  const providedProfileId = process.argv[2];
  let profileId: string;
  let exportToFile: boolean;

  if (!providedProfileId) {
    // No profile ID provided - use default and export to file
    const defaultId = await getDefaultProfileId();
    if (!defaultId) {
      console.error(
        "❌ Error: No profile ID provided and no default profile is set",
      );
      console.error("\nUsage: npm run docker:export-profile-json [profileId]");
      console.error(
        "\nSet a default profile or provide a profile ID",
      );
      process.exit(1);
    }
    profileId = defaultId.toString();
    exportToFile = true;
    console.log(`Using default profile: ${profileId}`);
  } else {
    // Profile ID provided as argument
    profileId = providedProfileId;
    exportToFile = true;
  }

  await exportProfile(profileId, exportToFile);
}

main().catch((error) => {
  console.error("Export failed:", error);
  process.exit(1);
});
