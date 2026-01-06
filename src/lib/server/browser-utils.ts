/**
 * Browser utilities for Playwright
 * Provides Chrome detection and browser context creation
 */

import { existsSync } from "fs";
import { type BrowserContext, chromium } from "patchright";

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
  // const args = [
  //   "--no-sandbox",
  //   "--disable-setuid-sandbox",
  //   "--disable-dev-shm-usage",
  //   "--disable-blink-features=AutomationControlled",
  //   "--disable-features=IsolateOrigins,site-per-process",
  //   "--disable-process-singleton-lock", // Allow multiple instances with same profile
  // ];

  console.log(`🚀 Launching persistent browser context...`);
  console.log(`📂 Profile directory: ${userDataDir}`);

  const viewport = options.headless ? { width: 1920, height: 1080 } : null;

  // if (options.headless) {
  //   args.push("--start-maximized");
  // }

  try {
    const context = await chromium.launchPersistentContext(userDataDir, {
      executablePath,
      headless: !!options.headless,
      // args,
      viewport,
      // userAgent:
      //   "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      // locale: "en-US",
      // timezoneId: "America/New_York",
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

/**
 * Wait for dynamic job content to load on LinkedIn and similar sites
 * Waits for "Loading job details" text to disappear, indicating content has loaded
 * @param page Playwright page instance
 * @param timeout Maximum time to wait in milliseconds (default: 10000)
 */
export async function waitForJobContentToLoad(
  page: Page,
  timeout = 10000,
): Promise<void> {
  try {
    await page.waitForFunction(
      () => !document.body.textContent?.includes("Loading job details"),
      { timeout },
    );
    // Give it a bit more time for content to render
    await page.waitForTimeout(1000);
  } catch (e) {
    // Timeout is not critical - proceed anyway
    // Silently continue (caller can log if needed)
  }
}
