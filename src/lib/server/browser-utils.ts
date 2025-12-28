/**
 * Browser utilities for Playwright
 * Provides Chrome detection and browser context creation
 */

import { existsSync } from "fs";
import { type BrowserContext, chromium } from "playwright";

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
 * Launch browser with persistent context (saved cookies, localStorage, etc.)
 * This is the primary browser launch method for maintaining sessions across runs.
 * Uses Playwright's launchPersistentContext which is equivalent to Puppeteer's userDataDir.
 */
export async function launchBrowser(
  userDataDir: string,
  options: BrowserLaunchOptions = {},
): Promise<BrowserContext> {
  const executablePath = findChromeExecutable();

  // Base anti-detection arguments
  const baseArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
    "--disable-features=IsolateOrigins,site-per-process",
    "--disable-process-singleton-lock", // Allow multiple instances with same profile
  ];

  // Merge with user-provided args
  const args = [...baseArgs, ...(options.args || [])];

  try {
    console.log(`🚀 Launching persistent browser context...`);
    console.log(`📂 Profile directory: ${userDataDir}`);

    const context = await chromium.launchPersistentContext(userDataDir, {
      executablePath,
      headless: options.headless ?? false,
      args,
      viewport: options.viewport !== undefined
        ? options.viewport
        : { width: 1920, height: 1080 },
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "en-US",
      timezoneId: "America/New_York",
    });

    console.log("✅ Persistent context created successfully");
    return context;
  } catch (error) {
    console.error(
      "❌ Failed to launch persistent context:",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}
