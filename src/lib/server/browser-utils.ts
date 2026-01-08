/**
 * Browser utilities for Playwright
 * Provides Chrome detection and browser context creation
 */

import { existsSync } from "fs";
import { type BrowserContext, chromium, type Page } from "patchright";
import { newInjectedContext } from "fingerprint-injector";
import { generateFingerprintOptions } from "./fingerprint-utils";

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
  cookies?: Array<{
    name: string;
    value: string;
    domain: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
  }>;
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
 * Launch browser with randomized fingerprint (NO persistent context)
 * This creates a fresh browser context on each run with a new fingerprint to avoid detection.
 * Cookies and session data should be stored separately and restored as needed.
 */
export async function launchBrowser(
  options: BrowserLaunchOptions = {},
): Promise<BrowserContext> {
  const executablePath = findChromeExecutable();

  console.log(`🚀 Launching browser with randomized fingerprint...`);

  const viewport = options.headless ? { width: 1920, height: 1080 } : null;

  try {
    // Generate fingerprint options
    const fingerprintOptions = generateFingerprintOptions({
      browserName: "chrome",
      deviceCategory: "desktop",
      operatingSystems: ["windows", "linux", "macos"],
      locales: ["en-US", "en-GB", "en"],
    });

    // Launch browser
    const browser = await chromium.launch({
      executablePath,
      headless: !!options.headless,
      args: options.args,
    });

    // Create context with injected fingerprint
    const context = await newInjectedContext(browser, {
      fingerprintOptions,
      newContextOptions: {
        viewport,
      },
    });

    // Restore cookies if provided
    if (options.cookies && options.cookies.length > 0) {
      await context.addCookies(options.cookies);
      console.log(`🍪 Restored ${options.cookies.length} cookies`);
    }

    console.log("✅ Browser context created with randomized fingerprint");
    return context;
  } catch (error) {
    console.error(
      "❌ Failed to launch browser context:",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

/**
 * Wait for dynamic job content to load on LinkedIn and similar sites
 * Handles lazy loading by scrolling and waiting for loading indicators to disappear
 * @param page Playwright page instance
 * @param timeout Maximum time to wait in milliseconds (default: 15000)
 */
export async function waitForJobContentToLoad(
  page: Page,
  timeout = 15000,
): Promise<void> {
  try {
    // Scroll down to trigger lazy loading of company info and other sections
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await page.waitForTimeout(500);

    // Scroll to bottom to ensure all lazy-loaded content triggers
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(500);

    // Wait for common loading indicators to disappear
    await page.waitForFunction(
      () => {
        const text = document.body.textContent || "";
        // Check for various loading indicators
        return (
          !text.includes("Loading job details") &&
          !text.includes("Loading...") &&
          // Check for LinkedIn skeleton loaders
          document.querySelectorAll(
              ".jobs-details__main-content .artdeco-loader",
            )
              .length === 0
        );
      },
      { timeout },
    );

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));

    // Give content extra time to render after scrolling
    await page.waitForTimeout(1000);
  } catch (e) {
    // Timeout is not critical - proceed anyway with what we have
    // Silently continue (caller can log if needed)
  }
}
