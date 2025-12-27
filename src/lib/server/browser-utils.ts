/**
 * Browser utilities for Playwright
 * Provides Chrome detection and browser context creation
 */

import { existsSync } from "fs";
import {
  type Browser,
  type BrowserContext,
  chromium,
  type LaunchOptions,
} from "playwright";

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
  userDataDir?: string;
  args?: string[];
  viewport?: { width: number; height: number } | null;
}

/**
 * Find Google Chrome executable path
 * Priority: ENV var > known paths > undefined (fallback to Playwright's bundled Chromium)
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
    "⚠️  Google Chrome not found. Using Playwright bundled Chromium.",
  );
  console.warn("   For better bot detection avoidance, install Chrome:");
  console.warn("   Ubuntu/Debian: sudo apt install google-chrome-stable");
  console.warn("   Or set: export CHROME_EXECUTABLE_PATH=/path/to/chrome");
  return undefined;
}

/**
 * Get browser launch options
 */
export function getBrowserLaunchOptions(
  options: BrowserLaunchOptions = {},
): LaunchOptions {
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
    args,
  };
}

/**
 * Launch browser with Playwright (built-in stealth)
 */
export async function launchStealthBrowser(
  options: BrowserLaunchOptions = {},
): Promise<Browser> {
  const launchOptions = getBrowserLaunchOptions(options);

  try {
    console.log("🚀 Launching Playwright browser...");
    const browser = await chromium.launch(launchOptions);
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

/**
 * Create browser context with stealth configuration
 * Playwright uses contexts for isolation (like incognito windows with separate sessions)
 */
export async function createBrowserContext(
  browser: Browser,
  options: {
    userDataDir?: string;
    viewport?: { width: number; height: number } | null;
  } = {},
): Promise<BrowserContext> {
  return await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: options.viewport !== undefined
      ? options.viewport
      : { width: 1920, height: 1080 },
    locale: "en-US",
    timezoneId: "America/New_York",
    storageState: options.userDataDir
      ? `${options.userDataDir}/state.json`
      : undefined,
  });
}
