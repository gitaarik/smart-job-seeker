#!/usr/bin/env node

// This script must be run from the root dir:
//
//     node scripts/export-resume-pdf.js
//
// But you can just use `npm run export-resume` (package.json script)

import { launchBrowser } from "$lib/server/browser/utils";
import path from "path";
import fs from "fs";
import { dbDirect } from "$lib/server/db";
import { getEnv } from "$lib/tools/get-env";
import { getDefaultProfileId } from "$lib/server/profile/default";
import { createProfileExport } from "$lib/server/profile/exports";
import { buildExportUrl } from "$lib/server/utils/export-url-builder";

const appPort = getEnv("SJS_APP_PORT", "5173");

async function exportProfilesToPDF(profileId?: number) {
  console.log("🚀 Starting profile PDF export (Resume & CV)...");

  // Launch browser with randomized fingerprint
  const context = await launchBrowser({
    headless: true,
  });

  // Track if profile ID was explicitly provided
  const isExplicitProfileId = profileId !== undefined;

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

  console.log(`\n📋 Profile: ${profile.name || `ID ${profile.id}`}`);
  console.log(
    `📍 Export Mode: ${
      isExplicitProfileId ? "Directus only" : "Filesystem + Directus"
    }`,
  );
  console.log(`📦 Profile Versions: ${profile.profile_versions.length}`);

  // Define the versions to create for both resume and cv
  const profileVersions = profile.profile_versions.map((v) => v.name || "");
  const documentTypes = [
    { type: "resume", display: "Resume" },
    { type: "cv", display: "CV" },
  ] as const;

  const versions = documentTypes.flatMap((doc) =>
    profileVersions.map((version) => ({
      route: `${doc.type}?version=${version}`,
      dirName: `${doc.type}/${version || "full"}`,
      docType: doc.type,
      displayType: doc.display,
      versionName: version, // Raw version name for export_format
      description: `${doc.display} (${
        version
          ? version.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())
          : "Full"
      })`,
    }))
  );

  console.log(`\n📄 Export Formats (${versions.length} total):`);
  documentTypes.forEach((doc) => {
    const count = profileVersions.length;
    console.log(
      `   • ${doc.display}: ${count} version${count !== 1 ? "s" : ""} (PDF)`,
    );
  });

  try {
    const page = await context.newPage();

    // Set viewport for consistent rendering
    await page.setViewportSize({
      width: 1200,
      height: 1600,
    });

    // Create base output directory if it doesn't exist (only for filesystem exports)
    let baseOutputDir: string | undefined;
    if (!isExplicitProfileId) {
      baseOutputDir = path.join(process.cwd(), "exports");
      if (!fs.existsSync(baseOutputDir)) {
        fs.mkdirSync(baseOutputDir, { recursive: true });
      }
    }

    // Process each version
    for (const version of versions) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`📄 Export: ${version.description}`);
      console.log(`   Profile: ${profile.name || `ID ${profile.id}`}`);
      console.log(`   Format: ${version.displayType}`);
      console.log(`   File Type: PDF`);

      // Create version-specific directory (only for filesystem exports)
      let versionDir: string | undefined;
      if (!isExplicitProfileId && baseOutputDir) {
        versionDir = path.join(baseOutputDir, version.dirName);
        if (!fs.existsSync(versionDir)) {
          fs.mkdirSync(versionDir, { recursive: true });
        }
      }

      // Load resume page
      const resumeUrl = `http://localhost:${appPort}/${version.route}`;
      console.log(`   URL: ${resumeUrl}`);

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

      // Generate PDF
      console.log(`\n   🔄 Generating PDF...`);

      let buffer: Buffer;

      if (isExplicitProfileId) {
        // Generate PDF to buffer only (no filesystem export)
        const pdfBuffer = await page.pdf({
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
        buffer = Buffer.from(pdfBuffer);
        console.log(
          `   ✅ Generated ${version.displayType} PDF (${
            (buffer.length / 1024).toFixed(1)
          } KB)`,
        );
      } else {
        // Generate PDF to filesystem
        if (!versionDir) {
          throw new Error("Version directory not set for filesystem export");
        }
        const outputPath = path.join(versionDir, filename);
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
        buffer = fs.readFileSync(outputPath);
        console.log(`   ✅ Saved to filesystem: ${outputPath}`);
        console.log(`   📦 File size: ${(buffer.length / 1024).toFixed(1)} KB`);
      }

      // Save to profile_exports collection
      try {
        console.log(`   🔄 Saving to Directus...`);

        // Build source URL from the route used for rendering
        const sourceUrl = buildExportUrl({
          route: version.route,
        });

        await createProfileExport({
          profileId: profile.id,
          fileBuffer: buffer,
          filename,
          fileType: "pdf",
          exportType: version.docType as "resume" | "cv",
          exportFormat: version.versionName, // Use raw version name for consistency with URL parameters
          description: `${version.description} - Generated ${
            new Date().toISOString()
          }`,
          sourceUrl: sourceUrl,
        });
        console.log(`   ✅ Saved to Directus (profile_exports)`);
        console.log(
          `   📝 Metadata: ${version.displayType} | PDF | ${version.description}`,
        );
      } catch (error) {
        console.error(
          `   ❌ Failed to save to Directus: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        if (isExplicitProfileId) {
          // For explicit profile ID, database save is critical
          throw error;
        }
        // For default profile, continue - filesystem export succeeded
      }
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`\n🎉 Export Complete!`);
    console.log(`   Profile: ${profile.name || `ID ${profile.id}`}`);
    console.log(`   Exports Created: ${versions.length}`);
    console.log(
      `   Formats: ${documentTypes.map((d) => d.display).join(", ")}`,
    );
    console.log(`   File Type: PDF`);
    console.log(
      `   Storage: ${
        isExplicitProfileId ? "Directus only" : "Filesystem + Directus"
      }`,
    );
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

// Run if this is the main module (works with both node and vite-node)
if (import.meta.url.startsWith("file://")) {
  main();
}

export { exportProfilesToPDF };
