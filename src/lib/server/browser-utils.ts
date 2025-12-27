/**
 * Browser utilities for Puppeteer with stealth configuration
 * Provides Chrome detection and anti-bot detection measures
 */

import { existsSync } from "fs";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, PuppeteerLaunchOptions } from "puppeteer";

// Add stealth plugin to puppeteer-extra
puppeteer.use(StealthPlugin());

// Chrome installation paths to check (Linux)
const CHROME_PATHS = [
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/opt/google/chrome/chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

export interface BrowserLaunchOptions {
  headless?: boolean | "new";
  userDataDir?: string;
  args?: string[];
  defaultViewport?: { width: number; height: number } | null;
}

/**
 * Find Google Chrome executable path
 * Priority: ENV var > known paths > undefined (fallback to Puppeteer's bundled Chromium)
 */
export function findChromeExecutable(): string | undefined {
  // 1. Check environment variable override
  if (process.env.CHROME_EXECUTABLE_PATH) {
    if (existsSync(process.env.CHROME_EXECUTABLE_PATH)) {
      console.log(
        `✅ Using Chrome from ENV: ${process.env.CHROME_EXECUTABLE_PATH}`,
      );
      return process.env.CHROME_EXECUTABLE_PATH;
    } else {
      console.warn(
        `⚠️  CHROME_EXECUTABLE_PATH not found: ${process.env.CHROME_EXECUTABLE_PATH}`,
      );
    }
  }

  // 2. Check known Chrome installation paths
  for (const path of CHROME_PATHS) {
    if (existsSync(path)) {
      console.log(`✅ Using Chrome: ${path}`);
      return path;
    }
  }

  // 3. Not found - fallback to bundled Chromium
  console.warn(
    "⚠️  Google Chrome not found. Using Puppeteer bundled Chromium.",
  );
  console.warn("   For better bot detection avoidance, install Chrome:");
  console.warn("   Ubuntu/Debian: sudo apt install google-chrome-stable");
  console.warn("   Or set: export CHROME_EXECUTABLE_PATH=/path/to/chrome");
  return undefined;
}

/**
 * Get browser launch options with stealth configuration
 */
export function getBrowserLaunchOptions(
  options: BrowserLaunchOptions = {},
): PuppeteerLaunchOptions {
  const executablePath = findChromeExecutable();

  // Base anti-detection arguments
  const baseArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled", // Hide automation
    "--disable-features=IsolateOrigins,site-per-process",
    "--window-size=1920,1080",
  ];

  // Merge with user-provided args
  const args = [...baseArgs, ...(options.args || [])];

  return {
    executablePath,
    headless: options.headless ?? false,
    userDataDir: options.userDataDir,
    args,
    defaultViewport: options.defaultViewport !== undefined
      ? options.defaultViewport
      : { width: 1920, height: 1080 },
  };
}

/**
 * Launch browser with stealth plugin
 */
export async function launchStealthBrowser(
  options: BrowserLaunchOptions = {},
): Promise<Browser> {
  const launchOptions = getBrowserLaunchOptions(options);

  try {
    console.log("🚀 Launching stealth browser...");
    const browser = await puppeteer.launch(launchOptions);
    console.log("✅ Browser launched successfully");
    return browser;
  } catch (error) {
    console.error(
      "❌ Failed to launch browser:",
      error instanceof Error ? error.message : String(error),
    );
    console.error("💡 Troubleshooting:");
    console.error(
      "   1. Ensure Chrome is installed: sudo apt install google-chrome-stable",
    );
    console.error(
      "   2. Or set custom path: export CHROME_EXECUTABLE_PATH=/path/to/chrome",
    );
    throw error;
  }
}
