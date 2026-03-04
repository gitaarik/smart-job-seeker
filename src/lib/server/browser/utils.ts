/**
 * Browser utilities for Playwright
 * Provides Chrome detection and browser context creation
 *
 * Uses persistent browser sessions that look like a normal browser
 * to anti-bot systems.
 */

import { existsSync } from "fs";
import { type BrowserContext, chromium } from "playwright";
import { config } from "$lib/server/config";

// Chrome installation paths to check (Linux)
const CHROME_PATHS = [
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/opt/google/chrome/chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

export interface BrowserLaunchOptions {
  headless?: boolean;
  args?: string[];
  viewport?: { width: number; height: number } | null;
}

/**
 * Find Google Chrome executable path
 * Priority: ENV var > known paths > undefined (fallback to Playwright's bundled Chromium)
 */
export function findChromeExecutable(): string | undefined {
  // 1. Check config override
  if (config.chromePath) {
    if (existsSync(config.chromePath)) {
      console.log(
        `✅ Using Chrome from config: ${config.chromePath}`,
      );
      return config.chromePath;
    } else {
      console.warn(
        `⚠️  SJS_CHROME_PATH not found: ${config.chromePath}`,
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
    "⚠️  Google Chrome not found. Using Playwright bundled Chromium.",
  );
  console.warn("   For better compatibility, install Chrome:");
  console.warn("   Ubuntu/Debian: sudo apt install google-chrome-stable");
  console.warn("   Or set: export SJS_CHROME_PATH=/path/to/chrome");
  return undefined;
}

/**
 * Launch browser with a fresh context
 * Since we use persistent browser sessions, this is simplified
 * and no longer needs fingerprint injection.
 */
export async function launchBrowser(
  options: BrowserLaunchOptions = {},
): Promise<BrowserContext> {
  const executablePath = findChromeExecutable();

  console.log(`🚀 Launching browser...`);

  const viewport = options.headless ? { width: 1920, height: 1080 } : null;

  const browser = await chromium.launch({
    executablePath,
    headless: !!options.headless,
    args: options.args,
  });

  const context = await browser.newContext({
    viewport,
  });

  console.log("✅ Browser context created successfully");
  return context;
}
