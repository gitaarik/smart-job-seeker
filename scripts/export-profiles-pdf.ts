#!/usr/bin/env node

// This script must be run from the root dir:
//
//     node scripts/export-resume-pdf.js
//
// But you can just use `npm run export-resume` (package.json script)

import { launchBrowser } from "$lib/server/browser-utils";
import path from "path";
import fs from "fs";
import { dbDirect } from "$lib/db";
import { getEnv } from "$lib/tools/get-env";
import { getDefaultProfileId } from "$lib/server/profile-default";
import { createProfileExport } from "$lib/server/profile-exports";

const appPort = getEnv("SJS_APP_PORT");

async function exportProfilesToPDF(profileId?: number) {
  console.log("🚀 Starting profile PDF export (Resume & CV)...");

  // Use persistent context for consistent rendering
  const profileDir = path.join(process.cwd(), "chrome-profiles", "pdf-export");
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  const context = await launchBrowser(profileDir, {
    headless: true,
  });

  // Get target profile ID
  const targetProfileId = profileId ?? (await getDefaultProfileId());

  if (!targetProfileId) {
    console.error("❌ No profile ID provided and no default profile set");
    process.exit(1);
  }

  // Fetch the profile with its versions
  const profile = await dbDirect.profiles.findUnique({
    where: { id: targetProfileId },
    include: {
      profile_versions: {
        where: {
          status: { equals: "published" },
        },
        orderBy: {
          sort: "asc",
        },
      },
    },
  });

  if (!profile) {
    console.error(
      `❌ Profile with ID ${targetProfileId} not found in database`,
    );
    process.exit(1);
  }

  // Define the versions to create for both resume and cv
  const profileVersions = profile.profile_versions.map((v) => v.name || "");
  const documentTypes = ["resume", "cv"];

  const versions = documentTypes.flatMap((docType) =>
    profileVersions.map((version) => ({
      route: `${docType}?version=${version}`,
      dirName: `${docType}/${version || "full"}`,
      docType,
      description: `${docType.toUpperCase()} (${
        version
          ? version.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())
          : "Full"
      })`,
    }))
  );

  try {
    const page = await context.newPage();

    // Set viewport for consistent rendering
    await page.setViewportSize({
      width: 1200,
      height: 1600,
    });

    // Create base output directory if it doesn't exist
    const baseOutputDir = path.join(process.cwd(), "src", "lib", "exports");
    if (!fs.existsSync(baseOutputDir)) {
      fs.mkdirSync(baseOutputDir, { recursive: true });
    }

    // Process each version
    for (const version of versions) {
      console.log(`\n📄 Processing ${version.description}...`);

      // Create version-specific directory
      const versionDir = path.join(baseOutputDir, version.dirName);
      if (!fs.existsSync(versionDir)) {
        fs.mkdirSync(versionDir, { recursive: true });
      }

      // Load resume page
      const resumeUrl = `http://localhost:${appPort}/${version.route}`;
      console.log(`🔗 Loading resume from: ${resumeUrl}`);

      await page.goto(resumeUrl, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // Ensure all images are loaded
      await page.evaluate(async () => {
        const images = Array.from(document.querySelectorAll("img"));
        await Promise.all(
          images.map((img) => {
            return new Promise((resolve) => {
              if (img.complete) {
                resolve();
              } else {
                img.onload = resolve;
                img.onerror = resolve;
              }
            });
          }),
        );
      });

      const versionName = version.docType === "cv" ? "CV" : "Resume";
      const filename =
        `Rik Wanders - Senior Full Stack Developer - ${versionName}.pdf`;
      const outputPath = path.join(versionDir, filename);

      // Generate PDF
      console.log("📝 Generating PDF...");
      await page.pdf({
        path: outputPath,
        format: "A4",
        waitForFonts: true,
        margin: {
          top: "0.4in",
          right: "0.5in",
          bottom: "0.4in",
          left: "0.5in",
        },
        printBackground: true,
        preferCSSPageSize: false,
      });

      console.log(`✅ ${version.description} exported to: ${outputPath}`);

      // Also save to profile_exports collection
      try {
        const buffer = fs.readFileSync(outputPath);
        await createProfileExport({
          profileId: profile.id,
          fileBuffer: buffer,
          filename,
          fileType: "pdf",
          exportType: version.docType as "resume" | "cv",
          exportFormat: version.description,
          description: `${version.description} - Generated ${new Date().toISOString()}`,
        });
        console.log(`✅ Also saved to profile_exports collection`);
      } catch (error) {
        console.warn(
          `⚠️  Failed to save to database: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Continue - filesystem export succeeded
      }
    }

    console.log("\n🎉 All resume versions exported successfully!");
  } catch (error) {
    console.error("❌ Error exporting resume to PDF:", error);
    process.exit(1);
  } finally {
    await context.close(); // Closes browser too (persistent context)
  }
}

// Check if development server is running
async function checkDevServer() {
  try {
    const response = await fetch(`http://localhost:${appPort}/resume`);
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  try {
    const serverRunning = await checkDevServer();

    if (!serverRunning) {
      console.error(
        `❌ Development server is not running on http://localhost:${appPort}`,
      );
      console.log("💡 Please start the dev server first with: npm run dev");
      process.exit(1);
    }

    // Parse profile ID from command line
    const profileId = process.argv[2]
      ? parseInt(process.argv[2], 10)
      : undefined;

    if (process.argv[2] && isNaN(profileId!)) {
      console.error(`❌ Invalid profile ID: ${process.argv[2]}`);
      process.exit(1);
    }

    await exportProfilesToPDF(profileId);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { exportProfilesToPDF };
