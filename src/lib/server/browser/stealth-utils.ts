/**
 * Stealth utilities for anti-bot detection evasion
 *
 * These utilities help make automated browsing appear more human-like:
 * - CDP script injection to hide automation markers
 * - Human-like mouse movement using Playwright's native mouse API
 * - Timing jitter to avoid robotic patterns
 */

import type { Page } from "playwright";

/**
 * Stealth script that hides automation markers
 * Injected via CDP to run before any page scripts
 */
const STEALTH_SCRIPT = `
  // 1. Hide webdriver property (main detection vector)
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
  });

  // 2. Hide Chrome DevTools Protocol markers
  // These window properties are created by CDP and reveal automation
  const cdpProps = [
    'cdc_adoQpoasnfa76pfcZLmcfl_Array',
    'cdc_adoQpoasnfa76pfcZLmcfl_Promise',
    'cdc_adoQpoasnfa76pfcZLmcfl_Symbol',
  ];
  cdpProps.forEach(prop => {
    try {
      if (prop in window) {
        delete window[prop];
      }
    } catch (e) {}
  });

  // 3. Fix permissions API (automation often has inconsistent permissions)
  if (navigator.permissions && navigator.permissions.query) {
    const originalQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission, onchange: null })
        : originalQuery(parameters)
    );
  }

  // 4. Make plugins array non-empty (headless has empty plugins)
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5],
  });

  // 5. Fix languages (some automation has empty languages array)
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
  });

  // 6. Fix Chrome object (missing in some automation contexts)
  if (!window.chrome) {
    window.chrome = {
      runtime: {},
    };
  }
`;

/**
 * Inject stealth scripts via CDP to hide automation markers
 *
 * This should be called after connecting via CDP but before any navigation.
 * The script runs both on the current page and on all future navigations.
 *
 * @param page - Playwright Page object
 */
export async function injectStealthScripts(page: Page): Promise<void> {
  try {
    const cdpSession = await page.context().newCDPSession(page);

    // For future navigations - script runs at document creation
    await cdpSession.send("Page.addScriptToEvaluateOnNewDocument", {
      source: STEALTH_SCRIPT,
    });

    // For the CURRENT page (already loaded by Browser-Use)
    await page.evaluate(STEALTH_SCRIPT);

    console.log("[Stealth] Scripts injected successfully");
  } catch (error) {
    // Don't fail the scraper if stealth injection fails
    console.warn("[Stealth] Failed to inject scripts:", error);
  }
}

/**
 * Add random jitter to a base duration
 *
 * Humans don't perform actions at perfectly consistent intervals.
 * This function adds variance to make timing patterns appear natural.
 *
 * @param baseMs - Base duration in milliseconds
 * @param variancePercent - How much to vary (0.0-1.0), default 0.4 (40%)
 * @returns Duration with random jitter applied
 *
 * @example
 * humanDelay(2000) // Returns 1200-2800ms (40% variance)
 * humanDelay(1000, 0.5) // Returns 500-1500ms (50% variance)
 */
export function humanDelay(baseMs: number, variancePercent = 0.4): number {
  const variance = baseMs * variancePercent;
  const jitter = (Math.random() - 0.5) * 2 * variance;
  return Math.max(100, Math.round(baseMs + jitter)); // Minimum 100ms
}

/**
 * Wait with human-like timing variance
 *
 * @param page - Playwright Page object
 * @param baseMs - Base duration in milliseconds
 * @param variancePercent - How much to vary (0.0-1.0), default 0.4
 */
export async function humanWait(
  page: Page,
  baseMs: number,
  variancePercent = 0.4,
): Promise<void> {
  const delay = humanDelay(baseMs, variancePercent);
  await page.waitForTimeout(delay);
}

/**
 * Options for human-like mouse wheel scrolling
 */
export interface HumanScrollOptions {
  /** Base pixels per wheel scroll (default: 400) */
  baseScrollAmount?: number;
  /** +/- variation in scroll amount (default: 200) */
  scrollVariation?: number;
  /** Base ms between scrolls (default: 300) */
  baseScrollDelay?: number;
  /** +/- variation in delay (default: 200) */
  delayVariation?: number;
  /** Number of scroll steps to perform (default: 5) */
  scrollSteps?: number;
  /** Whether to scroll back to top after scrolling down (default: false) */
  scrollBackToTop?: boolean;
}

/**
 * Scroll using mouse wheel with human-like randomization
 *
 * Positions the mouse at the given coordinates and scrolls with randomized
 * amounts and delays to appear more human-like.
 *
 * @param page - Playwright Page object
 * @param mouseX - X coordinate to position mouse
 * @param mouseY - Y coordinate to position mouse
 * @param options - Scroll configuration options
 * @returns Number of scroll steps performed
 */
export async function humanScrollWheel(
  page: Page,
  mouseX: number,
  mouseY: number,
  options: HumanScrollOptions = {},
): Promise<number> {
  const {
    baseScrollAmount = 400,
    scrollVariation = 200,
    baseScrollDelay = 300,
    delayVariation = 200,
    scrollSteps = 5,
    scrollBackToTop = false,
  } = options;

  // Helper to get randomized scroll amount
  const getRandomScroll = () =>
    baseScrollAmount + (Math.random() - 0.5) * 2 * scrollVariation;
  // Helper to get randomized delay
  const getRandomDelay = () => baseScrollDelay + Math.random() * delayVariation;

  // Move mouse to scroll position
  await page.mouse.move(mouseX, mouseY);

  // Scroll down with human-like randomization
  for (let i = 0; i < scrollSteps; i++) {
    await page.mouse.wheel(0, getRandomScroll());
    await page.waitForTimeout(getRandomDelay());
  }

  // Scroll back to top if requested (faster)
  if (scrollBackToTop) {
    for (let i = 0; i < scrollSteps + 3; i++) {
      await page.mouse.wheel(0, -getRandomScroll() * 2);
      await page.waitForTimeout(50 + Math.random() * 100);
    }
  }

  return scrollSteps;
}

/**
 * Click an element with human-like mouse movement
 *
 * Instead of instantly clicking, this:
 * 1. Moves the cursor naturally to the element (curved path with steps)
 * 2. Adds a small random pause
 * 3. Clicks
 *
 * Uses Playwright's native mouse API for human-like cursor movement.
 *
 * @param page - Playwright Page object
 * @param selector - CSS selector for the element to click
 */
export async function humanClick(
  page: Page,
  selector: string,
  options: { timeout?: number } = {},
): Promise<void> {
  const timeout = options.timeout ?? 5000;
  const element = page.locator(selector);

  // Scroll element into view first
  await element.scrollIntoViewIfNeeded({ timeout });

  // Wait for element to be visible
  await element.waitFor({ state: "visible", timeout });

  // Get bounding box for coordinate-based click
  const box = await element.boundingBox({ timeout });
  if (!box) {
    throw new Error(`Cannot get bounding box for element: ${selector}`);
  }

  // Calculate target point with slight randomness (not dead center)
  const paddingX = box.width * 0.1;
  const paddingY = box.height * 0.1;
  const targetX = box.x + paddingX +
    Math.random() * (box.width - 2 * paddingX);
  const targetY = box.y + paddingY +
    Math.random() * (box.height - 2 * paddingY);

  // Move to element with multiple steps (more human-like than instant teleport)
  const steps = 10 + Math.floor(Math.random() * 10); // 10-20 steps
  await page.mouse.move(targetX, targetY, { steps });

  // Small pause before clicking (humans don't click instantly)
  await page.waitForTimeout(50 + Math.random() * 100);

  // Click at coordinates - dispatches real mousedown/mouseup/click events
  // This hits whatever element is actually at those coordinates
  await page.mouse.click(targetX, targetY);
}
