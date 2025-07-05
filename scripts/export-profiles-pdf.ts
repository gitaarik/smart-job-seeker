#!/usr/bin/env node

// This script must be run from the root dir:
//
//     node scripts/export-resume-pdf.js
//
// But you can just use `npm run export-resume` (package.json script)

import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

// Dynamically import Prisma to avoid issues with client generation
let prisma: any;

async function initPrisma() {
  try {
    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient();
    console.log("✓ Prisma client initialized");
  } catch (error) {
    console.error("❌ Failed to initialize Prisma client:", error);
    throw error;
  }
}

async function exportProfilesToPDF() {
  console.log("🚀 Starting profile PDF export (Resume & CV)...");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  // Fetch the first profile with its versions
  const profile = await prisma.profiles.findFirst({
    include: {
      profile_versions: {
        orderBy: {
          sort: "asc",
        },
      },
    },
  });

  if (!profile) {
    console.error("❌ No profile found in database");
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
    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2,
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
      const resumeUrl = `http://localhost:5173/${version.route}`;
      console.log(`🔗 Loading resume from: ${resumeUrl}`);

      await page.goto(resumeUrl, {
        waitUntil: "networkidle0",
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
    }

    console.log("\n🎉 All resume versions exported successfully!");
  } catch (error) {
    console.error("❌ Error exporting resume to PDF:", error);
    process.exit(1);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

// Check if development server is running
async function checkDevServer() {
  try {
    const response = await fetch("http://localhost:5173/resume");
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  try {
    await initPrisma();

    const serverRunning = await checkDevServer();

    if (!serverRunning) {
      console.error(
        "❌ Development server is not running on http://localhost:5173",
      );
      console.log("💡 Please start the dev server first with: npm run dev");
      process.exit(1);
    }

    await exportProfilesToPDF();
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
