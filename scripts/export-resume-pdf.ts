#!/usr/bin/env node

// This script must be run from the root dir:
//
//     node scripts/export-resume-pdf.js
//
// But you can just use `npm run export-resume` (package.json script)

import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

async function exportResumeToPDF() {
  console.log("🚀 Starting resume PDF export...");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  // Define the versions to create
  const resumeTypes = [
    "", // Full resume
    "fullstack-python",
    "fullstack-django",
    "fullstack-react",
    "fullstack-svelte",
    "datascience",
  ];

  const versions = resumeTypes.map((type) => ({
    route: `resume?type=${type}`,
    dirName: `${type || "full"}`,
    description: `ATS Resume (${
      type.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())
    })`,
    isATS: true,
  }));

  try {
    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2,
    });

    // Create base output directory if it doesn't exist
    const baseOutputDir = path.join(process.cwd(), "src", "lib", "resumes");
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

      const outputPath = path.join(versionDir, "Resume Rik Wanders.pdf");

      // Configure different settings for ATS vs Visual resume
      const isATS = version.isATS;

      const footerTemplate = `
        <div style="
          display: flex;
          justify-content: end;
          font-size: 12px; 
          padding: 0 50px 15px; 
          width: 100%; 
          color: #54889c;
        ">
          <div style="margin-right: 5px;">
            <svg viewBox="0 0 2159.5601 1568.96" width="15" height="15">
              <g transform="translate(-101.76 -135.84)" fill="#2c708b">
                <g transform="translate(-169.65 163.8)">
                  <path
                    transform="matrix(.13333 0 0 -.13333 0 5333.3)"
                    d="m7317.4 31709h-1617.8l-2059.2 3567.1 2059.2 3567.2h1617.8l-2060-3567.2zm-2435.3 8500.5-2555.9-4429.4-290.7-504 290.7-503.2 2548.5-4415.6h3060.7l1331.3 3803.3 2117 6048.9h-6501.6"
                  />
                  <path
                    transform="matrix(.13333 0 0 -.13333 0 5333.3)"
                    d="m14568 29809h-1617.9l2060 3567.2-2060 3567.1h1617.9l2058.4-3567.1zm3373.3 4069.6-2548.5 4416.4h-3060.7l-1331.3-3803.3-2117-6048.9h6500.9l2556.6 4429.4 290.7 504-290.7 502.4"
                  />
                </g>
              </g>
            </svg>
          </div>

          <div>
            Rik Wanders – Senior Full Stack Developer
            (<span class="pageNumber"></span>/<span class="totalPages"></span>)
        </div>
      `;

      const options = isATS
        ? {
          displayHeaderFooter: false,
        }
        : {
          displayHeaderFooter: true,
          headerTemplate: `<div style="display: none;"></div>`,
          footerTemplate,
        };

      // Generate PDF
      console.log("📝 Generating PDF...");
      await page.pdf({
        path: outputPath,
        format: "A4",
        waitForFonts: true,
        margin: isATS
          ? {
            top: "0.4in",
            right: "0.5in",
            bottom: "0.4in",
            left: "0.5in",
          }
          : {
            top: "0px",
            right: "0px",
            bottom: "0px",
            left: "0px",
          },
        printBackground: true,
        preferCSSPageSize: false,
        ...options,
      });

      console.log(`✅ ${version.description} exported to: ${outputPath}`);
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
