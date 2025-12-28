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

    const clickableNodes: number[] = [];

    // Check each descendant for click listeners
    for (const nodeId of nodeIds) {
      try {
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

        if (hasClickListener) {
          clickableNodes.push(nodeId);
        }
      } catch (error) {
        // Node might have been removed or is not accessible, skip it
        continue;
      }
    }

    console.log(`Found ${clickableNodes.length} elements with click listeners`);

    // Mark elements with data-clickable-id attributes
    for (let i = 0; i < clickableNodes.length; i++) {
      try {
        // Add data-clickable-id attribute
        await client.send("DOM.setAttributeValue", {
          nodeId: clickableNodes[i],
          name: "data-clickable-id",
          value: String(i),
        });

        // Optionally add text content for LLM context
        try {
          const { outerHTML } = await client.send("DOM.getOuterHTML", {
            nodeId: clickableNodes[i],
          });

          // Extract text content from HTML
          const textMatch = outerHTML.match(/>([^<]{1,100})</);
          if (textMatch) {
            const text = textMatch[1].trim().substring(0, 50);
            if (text.length > 0) {
              await client.send("DOM.setAttributeValue", {
                nodeId: clickableNodes[i],
                name: "data-click-text",
                value: text,
              });
            }
          }
        } catch {
          // Failed to get text, continue without it
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
