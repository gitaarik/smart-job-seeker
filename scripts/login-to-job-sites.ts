#!/usr/bin/env node

/**
 * Login preparation script
 * Opens Chrome with persistent profile to allow manual login to job sites
 * User can then run the scraper with saved cookies/session
 */

import { launchBrowser } from "$lib/server/browser-utils";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

async function openBrowserForLogin(): Promise<void> {
  const { dbDirect } = await import("$lib/db");
  const {
    saveCookiesFromContext,
    getPlatformCredentials,
  } = await import("$lib/server/platform-auth");

  // Get default profile
  const defaultConfig = await dbDirect.config.findFirst();
  if (!defaultConfig?.default_profile) {
    console.error("❌ No default profile configured");
    process.exit(1);
  }

  const profileId = defaultConfig.default_profile;

  // Get all job platforms
  const platforms = await dbDirect.job_platforms.findMany({
    where: { status: "published" },
    orderBy: { name: "asc" },
  });

  if (platforms.length === 0) {
    console.error("❌ No job platforms configured");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(70));
  console.log("🌐  Job Site Login Preparation");
  console.log("=".repeat(70));
  console.log("Available platforms:");
  platforms.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} (${p.url})`);
  });
  console.log("=".repeat(70) + "\n");

  // For now, open browser for user to login manually to all sites
  // In the future, we can prompt which platform to login to
  console.log("Opening Chrome to log in to job sites...");
  console.log("Navigate to job sites and log in as needed.");
  console.log("\n📌 Press Ctrl+C when you're done logging in.");
  console.log("Your cookies will be saved to the database.\n");

  const context = await launchBrowser({ headless: false });

  try {
    console.log("✅ Chrome opened with randomized fingerprint");
    console.log("👉 Navigate to job sites and log in");
    console.log("📌 Press Ctrl+C when finished\n");

    // Create a new page with a helpful starting point
    const page = await context.newPage();

    // Show links to all platforms
    const platformLinks = platforms
      .map((p) => `<li><a href="${p.url}" target="_blank">${p.name}</a></li>`)
      .join("");

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Job Site Login</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              max-width: 800px;
              margin: 40px auto;
              padding: 20px;
            }
            h1 { color: #333; }
            ul { line-height: 2; }
            a { color: #0066cc; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <h1>🌐 Job Site Login</h1>
          <p>Click on a platform below to log in. Your session will be saved.</p>
          <ul>${platformLinks}</ul>
          <p><strong>When finished, press Ctrl+C in the terminal.</strong></p>
        </body>
      </html>
    `);

    // Keep browser open until user terminates
    await new Promise(() => {}); // Never resolves, waits for SIGINT
  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    // Save cookies for all platforms before closing
    console.log("\n💾 Saving cookies...");

    for (const platform of platforms) {
      try {
        await saveCookiesFromContext(context, profileId, platform.id);
        console.log(`   ✅ Saved cookies for ${platform.name}`);
      } catch (error) {
        console.error(
          `   ❌ Failed to save cookies for ${platform.name}:`,
          error,
        );
      }
    }

    await context.close();
  }
}

// Handle interrupts (Ctrl+C)
let isExiting = false;

async function handleExit(signal: string) {
  if (isExiting) return;
  isExiting = true;

  console.log(`\n\n✅ Received ${signal} - closing browser...`);
  console.log("Your login sessions have been saved!");
  console.log("You can now run: npm run host:scrape:jobs\n");
  process.exit(0);
}

process.on("SIGINT", () => handleExit("SIGINT"));
process.on("SIGTERM", () => handleExit("SIGTERM"));

// Execute
openBrowserForLogin().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
