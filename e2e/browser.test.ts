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

  it("logs in with valid credentials and lands on dashboard", async () => {
    await loginViaUI(b.page);
    expect(b.page.url()).toContain("/dashboard");
    const heading = await b.page.locator("h1").first().textContent();
    expect(heading?.trim()).toBe("Dashboard");
  });
});

// ============================================================================
// Dashboard
// ============================================================================

describe("dashboard", () => {
  const b = useBrowser();

  it("shows dashboard heading and sidebar navigation", async () => {
    await loginViaUI(b.page);
    await b.page.waitForLoadState("networkidle");

    const heading = await b.page.locator("h1").first().textContent();
    expect(heading?.trim()).toBe("Dashboard");

    // Sidebar has the main nav sections
    const sidebarText = await b.page.locator("aside, nav").first().textContent();
    expect(sidebarText).toContain("Job Search");
    expect(sidebarText).toContain("Profile");
  });

  it("shows billing plan info in sidebar", async () => {
    const planLink = b.page.locator('a[href="/dashboard/billing"]').first();
    expect(await planLink.isVisible()).toBe(true);
    const planText = await planLink.textContent();
    expect(planText?.toLowerCase()).toContain("plan");
  });
});

// ============================================================================
// Profile creation
// ============================================================================

describe("profile creation page", () => {
  const b = useBrowser();

  it("shows create profile heading and upload form", async () => {
    await loginViaUI(b.page);
    await b.page.goto("/dashboard/profile/create");
    await b.page.waitForLoadState("networkidle");

    const heading = await b.page.locator("h1").first().textContent();
    expect(heading?.trim()).toBe("Create Your Profile");
  });

  it("has file upload area and manual entry option", async () => {
    const uploadBtn = b.page.getByRole("button", { name: /upload.*parse/i });
    expect(await uploadBtn.isVisible()).toBe(true);

    const manualBtn = b.page.getByRole("button", { name: /skip to manual/i });
    expect(await manualBtn.isVisible()).toBe(true);
  });

  it("shows profile form when clicking skip to manual", async () => {
    await b.page.getByRole("button", { name: /skip to manual/i }).click();
    await b.page.waitForTimeout(500);

    // Should show full profile form with create button
    const createBtn = b.page.getByRole("button", { name: /create profile/i });
    expect(await createBtn.isVisible()).toBe(true);
    // Should have form sections
    const basicInfo = b.page.getByRole("button", { name: /basic information/i });
    expect(await basicInfo.isVisible()).toBe(true);
  });
});

// ============================================================================
// Jobs page
// ============================================================================

describe("jobs page", () => {
  const b = useBrowser();

  it("shows jobs heading and search bar", async () => {
    await loginViaUI(b.page);
    await b.page.goto("/dashboard/jobs");
    await b.page.waitForLoadState("networkidle");

    const heading = await b.page.locator("h1").first().textContent();
    expect(heading?.trim()).toContain("Jobs");

    const searchInput = b.page.locator('input[placeholder*="earch"]');
    expect(await searchInput.isVisible()).toBe(true);
  });

  it("can type in search bar", async () => {
    const searchInput = b.page.locator('input[placeholder*="earch"]');
    await searchInput.fill("software engineer");
    expect(await searchInput.inputValue()).toBe("software engineer");
  });

  it("can clear search bar", async () => {
    const searchInput = b.page.locator('input[placeholder*="earch"]');
    await searchInput.fill("test query");

    // Clear button should appear
    const clearBtn = b.page.locator('input[placeholder*="earch"] + button, input[placeholder*="earch"] ~ button').first();
    if (await clearBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await clearBtn.click();
      expect(await searchInput.inputValue()).toBe("");
    }
  });
});

// ============================================================================
// Billing page
// ============================================================================

describe("billing page", () => {
  const b = useBrowser();

  it("shows plan and usage heading", async () => {
    await loginViaUI(b.page);
    await b.page.goto("/dashboard/billing");
    await b.page.waitForLoadState("networkidle");

    const heading = await b.page.locator("h1").first().textContent();
    expect(heading?.trim()).toContain("Plan");
  });

  it("displays current plan info", async () => {
    const pageText = await b.page.textContent("main");
    // Should show some plan-related content
    expect(pageText?.toLowerCase()).toMatch(/explorer|seeker|hunter|contractor|free/);
  });

  it("shows available plans", async () => {
    // Look for plan upgrade/downgrade buttons or plan names
    const pageText = await b.page.textContent("main");
    expect(pageText).toContain("Explorer");
  });
});

// ============================================================================
// Contacts page
// ============================================================================

describe("contacts page", () => {
  const b = useBrowser();

  it("shows contacts heading", async () => {
    await loginViaUI(b.page);
    await b.page.goto("/dashboard/contacts");
    await b.page.waitForLoadState("networkidle");

    const heading = await b.page.locator("h1").first().textContent();
    expect(heading?.trim()).toBe("Contacts");
  });

  it("has add contact button", async () => {
    const addBtn = b.page.getByRole("button", { name: /add contact/i });
    expect(await addBtn.isVisible()).toBe(true);
  });

  it("shows email input when clicking add contact", async () => {
    await b.page.getByRole("button", { name: /add contact/i }).click();
    await b.page.waitForTimeout(500);

    const emailInput = b.page.locator('input[type="email"]');
    expect(await emailInput.isVisible()).toBe(true);
  });

  it("can close the add contact form", async () => {
    // "Add Contact" becomes "Cancel" when form is open
    await b.page.getByRole("button", { name: /cancel/i }).click();
    await b.page.waitForTimeout(500);

    const emailInput = b.page.locator('input[type="email"]');
    expect(await emailInput.isVisible()).toBe(false);
  });
});

// ============================================================================
// Export / Import page
// ============================================================================

describe("export/import page", () => {
  const b = useBrowser();

  it("shows import & export heading", async () => {
    await loginViaUI(b.page);
    await b.page.goto("/dashboard/export/import");
    await b.page.waitForLoadState("networkidle");

    const heading = await b.page.locator("h1").first().textContent();
    expect(heading?.trim()).toContain("Import");
  });
});

// ============================================================================
// Settings page
// ============================================================================

describe("settings page", () => {
  const b = useBrowser();

  it("shows settings heading", async () => {
    await loginViaUI(b.page);
    await b.page.goto("/dashboard/export/settings");
    await b.page.waitForLoadState("networkidle");

    const heading = await b.page.locator("h1").first().textContent();
    expect(heading?.trim()).toBe("Settings");
  });
});

// ============================================================================
// Navigation between pages
// ============================================================================

describe("cross-page navigation", () => {
  const b = useBrowser();

  it("can navigate through all main sections", async () => {
    await loginViaUI(b.page);

    const routes = [
      { path: "/dashboard", heading: "Dashboard" },
      { path: "/dashboard/jobs", heading: "Jobs" },
      { path: "/dashboard/applications/active", heading: "Applications" },
      { path: "/dashboard/billing", heading: "Plan" },
      { path: "/dashboard/contacts", heading: "Contacts" },
      { path: "/dashboard/export/import", heading: "Import" },
      { path: "/dashboard/export/settings", heading: "Settings" },
      { path: "/dashboard/profile/create", heading: "Create" },
    ];

    for (const route of routes) {
      await b.page.goto(route.path);
      await b.page.waitForLoadState("networkidle");
      const heading = await b.page.locator("h1").first().textContent();
      expect(heading?.trim().toLowerCase(), `${route.path} heading`).toContain(
        route.heading.toLowerCase(),
      );
    }
  });
});

// ============================================================================
// Unauthenticated access
// ============================================================================

describe("unauthenticated access", () => {
  const b = useBrowser();

  it("redirects all dashboard routes to login", async () => {
    const routes = [
      "/dashboard",
      "/dashboard/jobs",
      "/dashboard/billing",
      "/dashboard/contacts",
    ];

    for (const route of routes) {
      await b.page.goto(route);
      await b.page.waitForTimeout(500);
      expect(b.page.url(), `${route} should redirect`).toContain("/login");
    }
  });
});

// ============================================================================
// Logout
// ============================================================================

describe("logout", () => {
  const b = useBrowser();

  it("clearing cookies removes access to dashboard", async () => {
    await loginViaUI(b.page);
    await b.context.clearCookies();
    await b.page.goto("/dashboard");
    await b.page.waitForTimeout(1000);
    expect(b.page.url()).toContain("/login");
  });
});
