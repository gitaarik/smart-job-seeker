/**
 * Browser E2E — the add-skill popover on a job's unmatched skill pills.
 *
 * This covers the one layer SSR and API assertions can't reach: that the
 * popover actually opens on click, that "Show on CV" defaults to off, and that
 * it dismisses on an outside click. The dismissal case is the reason this file
 * exists — a click-outside handler is easy to get wrong in exactly one
 * direction, where the same click that opens the popover immediately closes it
 * again, and nothing but a real browser will tell you.
 *
 * Deliberately non-mutating: it never completes the add, so the profile is
 * untouched and the suite is repeatable. The write paths are covered by unit
 * tests and were exercised directly against the API.
 *
 * Prerequisites: dev stack running, test user seeded (see browser.test.ts).
 */

import { beforeAll, describe, expect, it } from "vitest";
import { loginViaUI, useBrowser } from "./browser";

/**
 * A job whose required skills are all unmatched for the test profile, so every
 * pill is the interactive "I have this" kind rather than a plain matched one.
 */
const JOB_WITH_UNMATCHED_SKILLS = 2574;

/** Only unmatched pills carry this title, which is what makes them clickable. */
const ADD_PILL = 'button[title*="add it to my profile"]';

describe("profile-only skills popover", () => {
  const b = useBrowser();

  // Once per suite: the context is shared, and loginViaUI navigates to /login,
  // which redirects away once authenticated — leaving it waiting on an #email
  // field that never appears.
  beforeAll(async () => {
    await loginViaUI(b.page);
  });

  async function openJob() {
    await b.page.goto(`/jobs/${JOB_WITH_UNMATCHED_SKILLS}`);
    await b.page.waitForLoadState("networkidle");
  }

  async function openFirstPopover() {
    await openJob();
    const pill = b.page.locator(ADD_PILL).first();
    await pill.waitFor({ state: "visible", timeout: 15000 });
    await pill.click();
    return pill;
  }

  it("renders unmatched required skills as clickable add buttons", async () => {
    await openJob();
    expect(await b.page.locator(ADD_PILL).count()).toBeGreaterThan(0);
  });

  it("opens the popover with Show on CV defaulted off", async () => {
    await openFirstPopover();

    const toggle = b.page.getByRole("button", { name: "Show on CV" });
    await toggle.waitFor({ state: "visible", timeout: 10000 });

    // Off by default: the skill starts counting for matching without landing
    // on any document until the applicant says so.
    expect(await toggle.getAttribute("aria-pressed")).toBe("false");
    expect(await b.page.getByText(/Stays off your resume/i).first().isVisible())
      .toBe(true);
  });

  it("closes on an outside click without having added anything", async () => {
    await openFirstPopover();

    const toggle = b.page.getByRole("button", { name: "Show on CV" });
    await toggle.waitFor({ state: "visible", timeout: 10000 });

    // Somewhere neutral, well away from the popover.
    await b.page.locator("body").click({ position: { x: 5, y: 5 } });
    await toggle.waitFor({ state: "hidden", timeout: 5000 });
    expect(await toggle.isVisible()).toBe(false);

    // The pill is still the "add" kind — nothing was written.
    expect(await b.page.locator(ADD_PILL).count()).toBeGreaterThan(0);
  });

  it("reopens after being dismissed", async () => {
    // Guards the failure mode where the click-outside listener is armed
    // permanently and swallows every subsequent open.
    await openFirstPopover();
    await b.page.locator("body").click({ position: { x: 5, y: 5 } });

    const toggle = b.page.getByRole("button", { name: "Show on CV" });
    await b.page.locator(ADD_PILL).first().click();
    await toggle.waitFor({ state: "visible", timeout: 10000 });
    expect(await toggle.isVisible()).toBe(true);
  });
});
