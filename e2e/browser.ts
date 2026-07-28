/**
 * Browser E2E test fixture — connects to the dev Chrome container via CDP.
 *
 * Usage in tests:
 *   import { useBrowser, loginViaUI } from "./browser";
 *   const { page } = useBrowser();
 *
 * Each test suite gets an isolated BrowserContext (clean cookies/storage).
 * The CDP connection is shared across all suites in a test run.
 *
 * The Chrome container runs inside Docker. We resolve the app container's IP
 * via `docker compose exec` because Chrome may have HSTS cached for hostnames
 * like `app`, which would force HTTPS on an HTTP-only service.
 */

import { chromium, type Browser, type BrowserContext, type Page } from "patchright";
import { execSync } from "child_process";
import { beforeAll, afterAll, afterEach } from "vitest";

const CDP_URL = process.env.SJS_CDP_URL || "http://localhost:9222";

/** Resolve the app container's Docker IP so Chrome can reach it over HTTP. */
function resolveAppUrl(): string {
  if (process.env.SJS_BROWSER_URL) return process.env.SJS_BROWSER_URL;

  try {
    const ip = execSync(
      "docker compose exec -T chrome getent hosts app | awk '{print $1}'",
      { cwd: process.env.SJS_CLOUD_DIR || `${process.cwd()}/..`, encoding: "utf-8" },
    ).trim();
    if (ip) return `http://${ip}:5173`;
  } catch { /* fall through */ }

  return "http://app:5173";
}

let browser: Browser | null = null;
let appUrl: string | null = null;

async function connectBrowser(): Promise<Browser> {
  if (browser) return browser;
  browser = await chromium.connectOverCDP(CDP_URL);
  return browser;
}

/** Get the resolved app URL (available after first useBrowser() beforeAll runs). */
export function getAppUrl(): string {
  if (!appUrl) appUrl = resolveAppUrl();
  return appUrl;
}

/**
 * Test fixture: provides a fresh BrowserContext + Page per test suite.
 * Call at the top level of a describe() block.
 */
export function useBrowser() {
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    const url = getAppUrl();
    const b = await connectBrowser();
    context = await b.newContext({
      baseURL: url,
      viewport: { width: 1280, height: 720 },
    });
    page = await context.newPage();
  });

  afterEach(async () => {
    page.removeAllListeners("dialog");
  });

  afterAll(async () => {
    await context?.close();
  });

  return {
    get page() { return page; },
    get context() { return context; },
  };
}

/**
 * Log into the app via the login form.
 * Navigates to /login, fills credentials, submits, and waits for dashboard.
 *
 * Retries the whole flow, because in dev the click can land before the client
 * JS has hydrated: the button is visible and enabled, so Playwright considers
 * it actionable, but no handler is attached yet and the click is a silent
 * no-op — no request is issued at all and the page just sits on /login until
 * waitForURL times out. It reproduced at roughly one login in five, and with a
 * login per describe block that was enough to fail a third of the suite. A
 * freshly recreated app container makes it likelier, since Vite is still
 * transforming modules on demand.
 */
export async function loginViaUI(
  page: Page,
  email = "alex.morgan@example.com",
  password = "testpassword123",
) {
  const ATTEMPTS = 3;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    await page.goto("/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    try {
      await page.waitForURL("**/home**", { timeout: 10000 });
      return;
    } catch (err) {
      if (attempt === ATTEMPTS) {
        throw new Error(
          `Login did not reach the dashboard after ${ATTEMPTS} attempts ` +
            `(still at ${page.url()}). Original error: ${err}`,
        );
      }
    }
  }
}
