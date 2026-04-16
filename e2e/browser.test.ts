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
// Profile creation flow (create → verify → edit → sub-pages → delete)
// ============================================================================

describe("profile creation flow", () => {
  const b = useBrowser();
  const profileName = `E2E Test ${Date.now()}`;
  let profileId: string | null = null;

  it("creates a profile via manual entry", async () => {
    await loginViaUI(b.page);
    await b.page.goto("/dashboard/profile/create");
    await b.page.waitForLoadState("networkidle");

    // Switch to manual entry form (basic info section is already expanded)
    await b.page.getByRole("button", { name: /skip to manual/i }).click();
    await b.page.waitForTimeout(1000);

    // Fill required field: Full Name (first text input)
    await b.page.locator('input[type="text"]').first().fill(profileName);

    // Fill optional: Professional Title (second text input)
    await b.page.locator('input[type="text"]').nth(1).fill("Senior QA Engineer");

    // Submit and wait for redirect to /dashboard?profile=<id>
    await b.page.getByRole("button", { name: /create profile/i }).click();
    await b.page.waitForURL(/\/dashboard\?profile=\d+/, { timeout: 15000 });

    // Extract profile ID from redirect URL
    const match = b.page.url().match(/profile=(\d+)/);
    profileId = match?.[1] ?? null;
    expect(profileId).toBeTruthy();

    const heading = await b.page.locator("h1").first().textContent();
    expect(heading?.trim()).toBe("Dashboard");
  });

  it("shows the new profile in the edit page", async () => {
    // First ensure the new profile is selected via URL param
    await b.page.goto(`/dashboard?profile=${profileId}`);
    await b.page.waitForLoadState("networkidle");

    await b.page.goto("/dashboard/profile/edit");
    await b.page.waitForLoadState("networkidle");

    const heading = await b.page.locator("h1").first().textContent();
    expect(heading?.trim()).toBe("Basic Info");

    // Verify saved name (first text input on edit page)
    const nameValue = await b.page.locator('input[type="text"]').first().inputValue();
    expect(nameValue).toBe(profileName);
  });

  it("shows work experience page with add button", async () => {
    await b.page.goto("/dashboard/profile/work-experience");
    await b.page.waitForLoadState("networkidle");

    const heading = await b.page.locator("h1").first().textContent();
    expect(heading?.trim()).toBe("Work Experience");

    const addBtn = b.page.getByRole("button", { name: /add.*experience/i });
    expect(await addBtn.isVisible()).toBe(true);
  });

  it("shows education page with add button", async () => {
    await b.page.goto("/dashboard/profile/education");
    await b.page.waitForLoadState("networkidle");

    const heading = await b.page.locator("h1").first().textContent();
    expect(heading?.trim()).toBe("Education");

    const addBtn = b.page.getByRole("button", { name: /add.*education/i });
    expect(await addBtn.isVisible()).toBe(true);
  });

  it("shows skills page with add categories", async () => {
    await b.page.goto("/dashboard/profile/skills");
    await b.page.waitForLoadState("networkidle");

    const heading = await b.page.locator("h1").first().textContent();
    expect(heading?.trim()).toBe("Skills");

    const addBtn = b.page.getByRole("button", { name: /add category/i });
    expect(await addBtn.isVisible()).toBe(true);
  });

  it("shows languages page", async () => {
    await b.page.goto("/dashboard/profile/languages");
    await b.page.waitForLoadState("networkidle");

    const heading = await b.page.locator("h1").first().textContent();
    expect(heading?.trim()).toBe("Languages");
  });

  it("deletes the test profile via settings danger zone", async () => {
    // First ensure the test profile is selected
    await b.page.goto(`/dashboard?profile=${profileId}`);
    await b.page.waitForLoadState("networkidle");

    await b.page.goto("/dashboard/export/settings");
    await b.page.waitForLoadState("networkidle");

    // Type the profile name in the confirmation input
    const confirmInput = b.page.locator('input[placeholder="Enter profile name to confirm"]');
    await confirmInput.fill(profileName);

    // Click "Delete this profile" (enabled after name matches)
    await b.page.getByRole("button", { name: /delete this profile/i }).click();
    await b.page.waitForTimeout(500);

    // Click "Yes, delete permanently" in the final confirmation
    const finalDelete = b.page.getByRole("button", { name: /yes.*delete permanently/i });
    await finalDelete.click();

    // Should redirect to dashboard after deletion
    await b.page.waitForURL("**/dashboard**", { timeout: 10000 });
    expect(b.page.url()).toContain("/dashboard");
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
// Sidebar navigation via clicks
// ============================================================================

describe("sidebar navigation", () => {
  const b = useBrowser();

  it("navigates via sidebar section links", async () => {
    await loginViaUI(b.page);
    await b.page.goto("/dashboard/jobs");
    await b.page.waitForLoadState("networkidle");

    // Navigate back to Overview
    await b.page.locator("aside a").filter({ hasText: "Overview" }).click();
    await b.page.waitForURL("**/dashboard", { timeout: 5000 });
    expect(b.page.url()).toMatch(/\/dashboard$/);

    // Navigate to billing via plan link
    await b.page.locator('aside a[href="/dashboard/billing"]').first().click();
    await b.page.waitForURL("**/billing", { timeout: 5000 });
    expect(b.page.url()).toContain("/dashboard/billing");
  });

  it("expands Job Search and navigates to sub-pages", async () => {
    // Ensure Job Search section is expanded (click if "All Jobs" link not visible)
    const allJobsLink = b.page.locator("aside a").filter({ hasText: "All Jobs" });
    if (!(await allJobsLink.isVisible({ timeout: 500 }).catch(() => false))) {
      await b.page.locator("aside button").filter({ hasText: "Job Search" }).click();
      await b.page.waitForTimeout(300);
    }

    await allJobsLink.click();
    await b.page.waitForURL("**/jobs", { timeout: 5000 });
    expect(b.page.url()).toContain("/dashboard/jobs");
  });

  it("expands Applying and navigates to applications", async () => {
    const appLink = b.page.locator("aside a").filter({ hasText: "Applications" });
    if (!(await appLink.isVisible({ timeout: 500 }).catch(() => false))) {
      await b.page.locator("aside button").filter({ hasText: "Applying" }).click();
      await b.page.waitForTimeout(300);
    }

    await appLink.click();
    await b.page.waitForURL("**/applications/**", { timeout: 5000 });
    expect(b.page.url()).toContain("/dashboard/applications");
  });

  it("expands Profile and navigates to profile data", async () => {
    const profileLink = b.page.locator("aside a").filter({ hasText: "Profile Data" });
    if (!(await profileLink.isVisible({ timeout: 500 }).catch(() => false))) {
      await b.page.locator("aside button").filter({ hasText: "Profile" }).click();
      await b.page.waitForTimeout(300);
    }

    await profileLink.click();
    await b.page.waitForURL("**/profile/edit", { timeout: 5000 });
    expect(b.page.url()).toContain("/dashboard/profile/edit");
  });

  it("expands Data & Settings and navigates to import", async () => {
    const importLink = b.page.locator("aside a").filter({ hasText: "Import & Export" });
    if (!(await importLink.isVisible({ timeout: 500 }).catch(() => false))) {
      await b.page.locator("aside button").filter({ hasText: "Data & Settings" }).click();
      await b.page.waitForTimeout(300);
    }

    await importLink.click();
    await b.page.waitForURL("**/export/import", { timeout: 5000 });
    expect(b.page.url()).toContain("/dashboard/export/import");
  });
});

// ============================================================================
// Feedback form
// ============================================================================

describe("feedback form", () => {
  const b = useBrowser();

  it("opens feedback widget from sidebar", async () => {
    await loginViaUI(b.page);
    await b.page.waitForLoadState("networkidle");

    await b.page.getByRole("button", { name: /send feedback/i }).click();
    await b.page.waitForTimeout(500);

    // Feedback widget should appear with textarea
    const textarea = b.page.locator('textarea[placeholder*="mind"]');
    expect(await textarea.isVisible()).toBe(true);
  });

  it("shows category buttons", async () => {
    for (const category of ["Bug", "Feature", "Question"]) {
      const btn = b.page.getByRole("button", { name: category });
      expect(await btn.isVisible(), `${category} button`).toBe(true);
    }
  });

  it("can select a category and type a message", async () => {
    await b.page.getByRole("button", { name: "Bug" }).click();
    await b.page.locator('textarea[placeholder*="mind"]').fill("E2E test feedback");

    // Send button should be visible
    const sendBtn = b.page.getByRole("button", { name: /^send$/i });
    expect(await sendBtn.isVisible()).toBe(true);
  });

  it("submits feedback and shows success", async () => {
    await b.page.getByRole("button", { name: /^send$/i }).click();
    await b.page.waitForTimeout(2000);

    // Should show success message
    const successText = b.page.locator("text=Thanks for your feedback");
    expect(await successText.isVisible({ timeout: 5000 })).toBe(true);
  });
});

// ============================================================================
// Theme switching
// ============================================================================

describe("theme switching", () => {
  const b = useBrowser();

  it("opens user menu and shows theme toggle", async () => {
    await loginViaUI(b.page);
    await b.page.waitForLoadState("networkidle");

    // Click the avatar button (last button in header)
    await b.page.locator("header button").last().click();
    await b.page.waitForTimeout(300);

    // Theme button should be visible in dropdown
    const themeBtn = b.page.getByRole("button", { name: /^theme/i });
    expect(await themeBtn.isVisible()).toBe(true);
  });

  it("cycles through all three themes", async () => {
    const themes: string[] = [];

    // Click theme 3 times to cycle through all states
    for (let i = 0; i < 3; i++) {
      // Open dropdown if closed
      const themeBtn = b.page.getByRole("button", { name: /^theme/i });
      if (!(await themeBtn.isVisible({ timeout: 500 }).catch(() => false))) {
        await b.page.locator("header button").last().click();
        await b.page.waitForTimeout(300);
      }

      await b.page.getByRole("button", { name: /^theme/i }).click();
      await b.page.waitForTimeout(300);

      const cookies = await b.context.cookies();
      const theme = cookies.find((c) => c.name === "theme")?.value ?? "";
      themes.push(theme);
    }

    // Should have cycled through 3 distinct values (light, dark, auto in some order)
    expect(new Set(themes).size).toBe(3);
    expect(themes).toContain("light");
    expect(themes).toContain("dark");
    expect(themes).toContain("auto");
  });

  it("persists theme after page reload", async () => {
    // Get current theme class
    const classBefore = await b.page.locator("html").getAttribute("class");

    await b.page.reload();
    await b.page.waitForLoadState("networkidle");

    const classAfter = await b.page.locator("html").getAttribute("class");
    expect(classAfter).toBe(classBefore);
  });
});

// ============================================================================
// Applications pages
// ============================================================================

describe("applications pages", () => {
  const b = useBrowser();

  it("shows all applications heading", async () => {
    await loginViaUI(b.page);
    await b.page.goto("/dashboard/applications/active");
    await b.page.waitForLoadState("networkidle");

    const heading = await b.page.locator("h1").first().textContent();
    expect(heading?.trim()).toBe("All Applications");
  });

  it("shows salary prep page", async () => {
    await b.page.goto("/dashboard/applications/salary");
    await b.page.waitForLoadState("networkidle");

    const heading = await b.page.locator("h1").first().textContent();
    expect(heading?.trim()).toBe("Salary Prep");
  });
});

// ============================================================================
// Job detail page
// ============================================================================

describe("job detail page", () => {
  const b = useBrowser();

  it("navigates to a job detail from the jobs list", async () => {
    await loginViaUI(b.page);
    await b.page.goto("/dashboard/jobs");
    await b.page.waitForLoadState("networkidle");

    // Click the first job card link
    const jobLink = b.page.locator('main a[href*="/dashboard/jobs/"]').first();
    expect(await jobLink.isVisible()).toBe(true);

    const href = await jobLink.getAttribute("href");
    await jobLink.click();
    await b.page.waitForURL(`**${href}`, { timeout: 5000 });

    const heading = await b.page.locator("h1").first().textContent();
    expect(heading?.trim()).toBe("Job Details");
  });

  it("shows save button and job content", async () => {
    const saveBtn = b.page.getByRole("button", { name: /^save$/i });
    expect(await saveBtn.isVisible()).toBe(true);

    // Job detail should have substantial content
    const mainText = await b.page.locator("main").textContent();
    expect(mainText!.length).toBeGreaterThan(500);
  });
});

// ============================================================================
// Profile edit and save
// ============================================================================

describe("profile edit and save", () => {
  const b = useBrowser();
  const testTitle = `E2E Title ${Date.now()}`;
  let originalTitle = "";

  it("loads the edit page with profile data", async () => {
    await loginViaUI(b.page);
    await b.page.goto("/dashboard/profile/edit");
    await b.page.waitForLoadState("networkidle");

    const heading = await b.page.locator("h1").first().textContent();
    expect(heading?.trim()).toBe("Basic Info");

    // Name should be filled
    const nameValue = await b.page.locator('input[type="text"]').first().inputValue();
    expect(nameValue).toBeTruthy();
  });

  it("can edit and save the professional title", async () => {
    const titleInput = b.page.locator('input[type="text"]').nth(2);
    originalTitle = await titleInput.inputValue();

    await titleInput.fill(testTitle);
    await b.page.getByRole("button", { name: /^save$/i }).first().click();
    await b.page.waitForTimeout(2000);

    // Reload and verify persistence
    await b.page.reload();
    await b.page.waitForLoadState("networkidle");

    const savedValue = await b.page.locator('input[type="text"]').nth(2).inputValue();
    expect(savedValue).toBe(testTitle);
  });

  it("restores the original title", async () => {
    const titleInput = b.page.locator('input[type="text"]').nth(2);
    await titleInput.fill(originalTitle);
    await b.page.getByRole("button", { name: /^save$/i }).first().click();
    await b.page.waitForTimeout(2000);

    await b.page.reload();
    await b.page.waitForLoadState("networkidle");

    const restoredValue = await b.page.locator('input[type="text"]').nth(2).inputValue();
    expect(restoredValue).toBe(originalTitle);
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
