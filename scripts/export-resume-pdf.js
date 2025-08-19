#!/usr/bin/env node

import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportResumeToPDF() {
  console.log("🚀 Starting resume PDF export...");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  // Define the three versions to create
  const versions = [
    {
      timing: "project,part-time",
      dirName: "freelance-parttime",
      description: "Freelance & Part-time",
    },
    {
      timing: "project,full-time",
      dirName: "freelance-fulltime",
      description: "Freelance & Full-time",
    },
    {
      timing: "full-time",
      dirName: "fulltime",
      description: "Full-time",
    },
  ];

  try {
    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2,
    });

    // Create base output directory if it doesn't exist
    const baseOutputDir = path.join(process.cwd(), "dist");
    if (!fs.existsSync(baseOutputDir)) {
      fs.mkdirSync(baseOutputDir, { recursive: true });
    }

    // Process each version
    for (const version of versions) {
      console.log(`\n📄 Processing ${version.description} version...`);

      // Create version-specific directory
      const versionDir = path.join(baseOutputDir, version.dirName);
      if (!fs.existsSync(versionDir)) {
        fs.mkdirSync(versionDir, { recursive: true });
      }

      // Build URL with timing parameter
      const resumeUrl = `http://localhost:5173/resume?timing=${version.timing}`;
      console.log(`🔗 Loading resume from: ${resumeUrl}`);

      await page.goto(resumeUrl, {
        waitUntil: "networkidle0",
        timeout: 30000,
      });

      // Wait for fonts and icons to load
      console.log("⏳ Waiting for page to fully load...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

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

      const outputPath = path.join(versionDir, "Resume Rik Wanders.pdf");

      // Generate PDF
      console.log("📝 Generating PDF...");
      await page.pdf({
        path: outputPath,
        format: "A4",
        margin: {
          top: "0.5in",
          right: "0.5in",
          bottom: "0.5in",
          left: "0.5in",
        },
        printBackground: true,
        preferCSSPageSize: false,
      });

      console.log(
        `✅ ${version.description} resume exported to: ${outputPath}`,
      );
    }

    console.log("\n🎉 All resume versions exported successfully!");
  } catch (error) {
    console.error("❌ Error exporting resume to PDF:", error);
    process.exit(1);
  } finally {
    await browser.close();
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
  const serverRunning = await checkDevServer();

  if (!serverRunning) {
    console.error(
      "❌ Development server is not running on http://localhost:5173",
    );
    console.log("💡 Please start the dev server first with: npm run dev");
    process.exit(1);
  }

  await exportResumeToPDF();
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { exportResumeToPDF };

