/**
 * Browser E2E tests — full browser automation against the live dev server.
 *
 * These tests connect to the Chrome Docker container via CDP and interact
 * with the app like a real user would.
 *
 * Prerequisites:
 *   1. Docker dev stack running (npm start from cloud/)
 *   2. Test user seeded (alex.morgan@example.com / testpassword123)
 *
 * Run: npm run test:e2e
 */

import { describe, it, expect } from "vitest";
import { useBrowser, loginViaUI } from "./browser";

// ============================================================================
// Login flow
// ============================================================================

describe("login flow", () => {
  const b = useBrowser();

  it("shows the login page with form fields", async () => {
    await b.page.goto("/login");
    await b.page.waitForLoadState("networkidle");
    const heading = await b.page.locator("h2").textContent();
    expect(heading?.toLowerCase()).toContain("sign in");
    expect(await b.page.locator("#email").isVisible()).toBe(true);
    expect(await b.page.locator("#password").isVisible()).toBe(true);
  });

  it("rejects invalid credentials", async () => {
    await b.page.goto("/login");
    await b.page.locator("#email").fill("wrong@example.com");
    await b.page.locator("#password").fill("wrongpassword");
    await b.page.getByRole("button", { name: "Sign in" }).click();
    await b.page.waitForTimeout(1000);
    expect(b.page.url()).toContain("/login");
  });

  it("logs in with valid credentials", async () => {
    await loginViaUI(b.page);
    expect(b.page.url()).toContain("/dashboard");
  });

  it("shows the dashboard after login", async () => {
    await b.page.goto("/dashboard");
    await b.page.waitForLoadState("networkidle");
    expect(await b.page.locator("h1").first().isVisible()).toBe(true);
  });
});

// ============================================================================
// Dashboard navigation
// ============================================================================

describe("dashboard navigation", () => {
  const b = useBrowser();

  it("can navigate to jobs page", async () => {
    await loginViaUI(b.page);
    await b.page.goto("/dashboard/jobs");
    await b.page.waitForLoadState("networkidle");
    expect(await b.page.locator("h1").first().isVisible()).toBe(true);
    expect(b.page.url()).toContain("/dashboard/jobs");
  });

  it("can navigate to billing page", async () => {
    await b.page.goto("/dashboard/billing");
    await b.page.waitForLoadState("networkidle");
    expect(await b.page.locator("h1").first().isVisible()).toBe(true);
    expect(b.page.url()).toContain("/dashboard/billing");
  });

  it("can navigate to contacts page", async () => {
    await b.page.goto("/dashboard/contacts");
    await b.page.waitForLoadState("networkidle");
    expect(await b.page.locator("h1").first().isVisible()).toBe(true);
    expect(b.page.url()).toContain("/dashboard/contacts");
  });

  it("can navigate to profile creation", async () => {
    await b.page.goto("/dashboard/profile/create");
    await b.page.waitForLoadState("networkidle");
    expect(await b.page.locator("h1").first().isVisible()).toBe(true);
  });
});

// ============================================================================
// Logout
// ============================================================================

describe("logout", () => {
  const b = useBrowser();

  it("can log out and lose access to dashboard", async () => {
    await loginViaUI(b.page);
    await b.context.clearCookies();
    await b.page.goto("/dashboard");
    await b.page.waitForTimeout(1000);
    expect(b.page.url()).toContain("/login");
  });
});
