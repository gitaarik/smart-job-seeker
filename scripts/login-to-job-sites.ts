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
  // Ensure chrome profile directory exists (same as scraper)
  const profileDir = join(process.cwd(), "chrome-profiles");
  if (!existsSync(profileDir)) {
    mkdirSync(profileDir, { recursive: true });
  }

  const userDataDir = join(profileDir, "default");

  console.log("\n" + "=".repeat(70));
  console.log("🌐  Job Site Login Preparation");
  console.log("=".repeat(70));
  console.log("Opening Chrome with persistent profile...");
  console.log("Navigate to job sites and log in as needed.");
  console.log("Your login sessions will be saved for future scraping.");
  console.log("\n📌 Press Ctrl+C when you're done logging in.");
  console.log("=".repeat(70) + "\n");

  // Launch browser with persistent profile (saves cookies, localStorage, etc.)
  const context = await launchBrowser(userDataDir, {
    headless: false,
    args: ["--start-maximized"],
    viewport: null, // No viewport = maximized window
  });

  try {
    console.log("✅ Chrome opened with persistent profile");
    console.log("👉 Navigate to job sites and log in");
    console.log("📌 Press Ctrl+C when finished\n");

    // Create a new page with a helpful starting point
    const page = await context.newPage();
    await page.goto("about:blank");

    // Keep browser open until user terminates
    await new Promise(() => {}); // Never resolves, waits for SIGINT
  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
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
