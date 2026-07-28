/**
 * Browser E2E for the application-texts composer.
 *
 * The composer is deliberately the same widget before an AI thread exists and
 * after it — only the button row differs — so what is worth testing is that it
 * switches on the right signal and that writing your own version stays
 * reachable in both states.
 *
 * Nothing here triggers a real generation: clicking "AI advice" or "AI
 * generate" would spend credits and real tokens on every run, and the model's
 * behaviour is covered by `npm run llm:smoke` instead. This asserts the UI
 * states around those buttons, which is what a browser can check cheaply.
 *
 * Prerequisites: dev stack up, test user seeded (see browser.test.ts).
 *
 * Run: npm run test:e2e
 */

import { describe, expect, it } from "vitest";
import { loginViaUI, useBrowser } from "./browser";

/** The test user's seeded application, which already has one of each text. */
const APP_ID = 16;
const PROBE = "E2E composer probe — safe to delete";

describe("texts composer — no AI thread yet", () => {
  const b = useBrowser();
  // Set by the first test, used by the rest and removed by the last.
  let questionUrl: string | null = null;

  it("creates a question and opens its editor", async () => {
    await loginViaUI(b.page);
    await b.page.goto(`/applications/${APP_ID}/texts`);
    await b.page.waitForLoadState("networkidle");

    // The add menu closes on click-outside; its trigger has to sit inside
    // [data-add-menu] or the same click that opens it closes it again.
    await b.page.getByRole("button", { name: /^Add$/ }).first().click();
    await b.page.getByRole("button", { name: /Application Question/i }).click();

    await b.page.locator("#new-question").fill(PROBE);
    await b.page.getByRole("button", { name: /Add & open editor/i }).click();

    await b.page.waitForURL("**/texts/questions/**", { timeout: 10000 });
    questionUrl = b.page.url();
    expect(questionUrl).toContain("/texts/questions/");
  });

  it("offers the two thread-starting steps, not a followup", async () => {
    expect(questionUrl).toBeTruthy();
    await b.page.goto(questionUrl!);
    await b.page.waitForLoadState("networkidle");

    expect(await b.page.getByRole("button", { name: "AI advice" }).isVisible())
      .toBe(true);
    expect(
      await b.page.getByRole("button", { name: "AI generate" }).isVisible(),
    ).toBe(true);
    // There is no thread to follow up on yet.
    expect(await b.page.getByRole("button", { name: "Send to AI" }).count())
      .toBe(0);
  });

  it("invites an optional brief for that first turn", async () => {
    const composer = b.page.locator("textarea").last();
    expect(await composer.isVisible()).toBe(true);

    const placeholder = await composer.getAttribute("placeholder");
    // Optional is the point: leaving it blank must stay an obvious path.
    expect(placeholder).toMatch(/optional/i);
    expect(placeholder).toMatch(/leave blank/i);

    // A brief is accepted, and typing one must not send anything on its own.
    await composer.fill("Keep it under 100 words.");
    expect(await composer.inputValue()).toBe("Keep it under 100 words.");
    expect(await b.page.getByRole("button", { name: "Send to AI" }).count())
      .toBe(0);
  });

  it("keeps writing your own version one click away", async () => {
    const own = b.page.getByRole("button", {
      name: /Write \/ paste my own version/i,
    });
    expect(await own.isVisible()).toBe(true);

    await own.click();
    expect(await b.page.getByText("Your own version").isVisible()).toBe(true);
    expect(
      await b.page.getByRole("button", { name: /Save my version/i })
        .isVisible(),
    ).toBe(true);
    expect(
      await b.page.getByRole("button", { name: /Save & AI review/i })
        .isVisible(),
    ).toBe(true);

    await b.page.getByRole("button", { name: /^Cancel$/ }).first().click();
    expect(await b.page.getByText("Your own version").count()).toBe(0);
  });

  it("removes the probe question", async () => {
    await b.page.goto(`/applications/${APP_ID}/texts`);
    await b.page.waitForLoadState("networkidle");

    // Scope to the probe's own card so a second question is never hit.
    await b.page.locator("button", { hasText: PROBE })
      .getByLabel("Delete question").first().click();
    await b.page.getByRole("button", { name: /^Confirm$/ }).click();
    await b.page.waitForLoadState("networkidle");

    expect(await b.page.getByText(PROBE).count()).toBe(0);
  });
});

describe("texts composer — thread in progress", () => {
  const b = useBrowser();

  it("switches to a followup message once a thread exists", async () => {
    await loginViaUI(b.page);
    // The seeded cover letter already has an ai_chat_id, so it renders the
    // other branch of the same composer.
    await b.page.goto(`/applications/${APP_ID}/texts`);
    await b.page.waitForLoadState("networkidle");
    await b.page.getByRole("link", { name: "Edit" }).first().click();
    await b.page.waitForURL("**/texts/**", { timeout: 10000 });
    await b.page.waitForLoadState("networkidle");

    expect(await b.page.getByRole("button", { name: "Send to AI" }).isVisible())
      .toBe(true);
    // The starting steps belong to the empty state only.
    expect(await b.page.getByRole("button", { name: "AI advice" }).count())
      .toBe(0);

    const composer = b.page.locator("textarea").last();
    const placeholder = await composer.getAttribute("placeholder");
    expect(placeholder).toMatch(/message the ai/i);

    // Same escape hatch, same wording, mid-conversation.
    expect(
      await b.page.getByRole("button", {
        name: /Write \/ paste my own version/i,
      }).isVisible(),
    ).toBe(true);
  });
});
