/**
 * Chrome DevTools Protocol (CDP) utilities for Playwright
 * Provides advanced DOM inspection capabilities
 */

import type { Page } from "playwright";

/**
 * Mark all elements with click event listeners within a container
 * Uses CDP to detect actual event listeners (not just onclick attributes)
 * Returns count of marked elements
 *
 * @param page Playwright page instance
 * @param containerSelector CSS selector for container to scope search (e.g., ".job-list")
 * @returns Number of clickable elements marked
 */
export async function markClickableElementsInContainer(
  page: Page,
  containerSelector: string = "body",
): Promise<number> {
  // Create CDP session
  const client = await page.context().newCDPSession(page);

  try {
    // Enable DOM debugging
    await client.send("DOM.enable");

    // Try to enable DOMDebugger (might not be available in all Chrome versions)
    try {
      await client.send("DOMDebugger.enable");
    } catch (error) {
      console.warn(
        "⚠️  DOMDebugger.enable not available - will use basic DOM inspection",
      );
    }

    // Get the root document
    const { root } = await client.send("DOM.getDocument", { depth: -1 });

    // Find the container element
    const { nodeId: containerNodeId } = await client.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: containerSelector,
    });

    if (!containerNodeId) {
      console.warn(`Container ${containerSelector} not found`);
      await client.detach();
      return 0;
    }

    // Get all descendants of container
    const { nodeIds } = await client.send("DOM.querySelectorAll", {
      nodeId: containerNodeId,
      selector: "*",
    });

    console.log(
      `Checking ${nodeIds.length} elements in ${containerSelector} for click listeners...`,
    );

    const clickableNodes: Array<{ nodeId: number; text: string }> = [];

    // Exclusion patterns for UI chrome elements
    const excludePatterns = [
      "menu",
      "nav",
      "header",
      "footer",
      "pagination",
      "filter",
      "sort",
      "dropdown",
      "close",
      "modal",
      "dialog",
      "popup",
    ];

    // Exclude action button text patterns
    const excludeButtonTexts = [
      "apply",
      "apply now",
      "quick apply",
      "easy apply",
      "save",
      "share",
      "bookmark",
      "refer",
      "earn",
    ];

    // Check each descendant for click listeners
    for (const nodeId of nodeIds) {
      try {
        // Get element attributes for filtering
        const { attributes } = await client.send("DOM.getAttributes", {
          nodeId,
        });

        // Convert flat array to object for easier access
        const attrs: Record<string, string> = {};
        for (let i = 0; i < attributes.length; i += 2) {
          attrs[attributes[i]] = attributes[i + 1];
        }

        const className = attrs.class?.toLowerCase() || "";
        const role = attrs.role?.toLowerCase() || "";
        const ariaLabel = attrs["aria-label"]?.toLowerCase() || "";
        const ariaHaspopup = attrs["aria-haspopup"] === "true";

        // Filter out UI chrome elements
        const shouldExcludeByAttr = excludePatterns.some((pattern) =>
          className.includes(pattern) ||
          role.includes(pattern) ||
          ariaLabel.includes(pattern) ||
          (pattern === "menu" && ariaHaspopup)
        );

        if (shouldExcludeByAttr) {
          continue;
        }

        // Get element text content
        let elementText = "";
        try {
          const { outerHTML } = await client.send("DOM.getOuterHTML", {
            nodeId,
          });
          // Extract text content from HTML (simple regex)
          const textMatch = outerHTML.match(/>([^<]+)</);
          elementText = textMatch ? textMatch[1].trim().toLowerCase() : "";
        } catch {
          // Failed to get HTML, continue without text filtering
        }

        // Filter out apply/share/save buttons by text content
        const isExcludedButton = excludeButtonTexts.some((text) =>
          elementText.includes(text)
        );

        if (isExcludedButton) {
          continue;
        }

        // Get node name to check for anchor elements
        const { node } = await client.send("DOM.describeNode", { nodeId });
        const nodeName = node.nodeName.toLowerCase();

        // Check if this is an anchor element with href attribute
        const isAnchorWithHref = nodeName === "a" &&
          attrs.href !== undefined &&
          attrs.href !== "" &&
          !attrs.href.startsWith("#") &&
          !attrs.href.startsWith("javascript:");

        // Resolve node to remote object
        const { object } = await client.send("DOM.resolveNode", { nodeId });

        // Get event listeners for this element
        const { listeners } = await client.send(
          "DOMDebugger.getEventListeners",
          {
            objectId: object.objectId,
          },
        );

        // Check if element has click listener
        const hasClickListener = listeners.some(
          (listener: { type: string }) => listener.type === "click",
        );

        // Element is clickable if it has a click listener OR is an anchor with href
        if (hasClickListener || isAnchorWithHref) {
          clickableNodes.push({ nodeId, text: elementText });
        }
      } catch (error) {
        // Node might have been removed or is not accessible, skip it
        continue;
      }
    }

    console.log(
      `Found ${clickableNodes.length} clickable elements (click listeners + anchor links)`,
    );

    // Mark elements with data-extract-clickable-id attributes
    for (let i = 0; i < clickableNodes.length; i++) {
      const { nodeId, text } = clickableNodes[i];
      try {
        // Add data-extract-clickable-id attribute
        await client.send("DOM.setAttributeValue", {
          nodeId,
          name: "data-extract-clickable-id",
          value: String(i),
        });

        // Add text content for LLM context if available
        if (text.length > 0) {
          await client.send("DOM.setAttributeValue", {
            nodeId,
            name: "data-extract-click-text",
            value: text.substring(0, 50),
          });
        }
      } catch (error) {
        console.debug(`Failed to mark node ${i}:`, error);
      }
    }

    await client.detach();
    return clickableNodes.length;
  } catch (error) {
    console.error("CDP error:", error);
    await client.detach();
    throw error;
  }
}

/**
 * Mark all clickable elements on the entire page
 * Convenience wrapper for markClickableElementsInContainer with body selector
 *
 * @param page Playwright page instance
 * @returns Number of clickable elements marked
 */
export async function markClickableElements(page: Page): Promise<number> {
  return markClickableElementsInContainer(page, "body");
}

/**
 * Detect if a CAPTCHA is present on the page
 * Checks for common CAPTCHA types: reCAPTCHA, hCaptcha, Turnstile, and generic iframe CAPTCHAs
 */
export async function detectCaptchaOnPage(page: Page): Promise<boolean> {
  const hasCaptchaIframe = await page.locator('iframe[src*="captcha"]')
    .isVisible().catch(() => false);
  const hasRecaptcha = await page.locator(".g-recaptcha, #g-recaptcha")
    .isVisible().catch(() => false);
  const hasHcaptcha = await page.locator(".h-captcha, #h-captcha")
    .isVisible().catch(() => false);
  const hasTurnstile = await page.locator(".cf-turnstile")
    .isVisible().catch(() => false);

  return hasCaptchaIframe || hasRecaptcha || hasHcaptcha || hasTurnstile;
}
