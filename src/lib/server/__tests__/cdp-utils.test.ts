import { beforeEach, describe, expect, it, vi } from "vitest";
import { markClickableElementsInContainer } from "../cdp-utils";
import type { Page } from "playwright";

// Mock Page and CDP client
const createMockCDPClient = () => ({
  send: vi.fn(),
  detach: vi.fn(),
});

describe("markClickableElementsInContainer", () => {
  let mockPage: any;
  let mockClient: any;
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = createMockCDPClient();

    // Create a stable mock context that returns the same newCDPSession
    const newCDPSession = vi.fn().mockResolvedValue(mockClient);
    mockContext = { newCDPSession };

    mockPage = {
      context: vi.fn(() => mockContext),
    };
  });

  it("should mark job-detail buttons with priority", async () => {
    // Setup mock responses
    mockClient.send
      .mockResolvedValueOnce({}) // DOM.enable
      .mockResolvedValueOnce({}) // DOMDebugger.enable
      .mockResolvedValueOnce({ root: { nodeId: 1 } }) // DOM.getDocument
      .mockResolvedValueOnce({ nodeId: 2 }) // DOM.querySelector (container)
      .mockResolvedValueOnce({ nodeIds: [10, 11, 12] }) // DOM.querySelectorAll
      // First element: job-description button (no getOuterHTML for job-detail buttons)
      .mockResolvedValueOnce({
        attributes: ["class", "ant-btn job-description ant-btn-default"],
      }) // getAttributes
      .mockResolvedValueOnce({ object: { objectId: "obj1" } }) // resolveNode
      .mockResolvedValueOnce({ listeners: [{ type: "click" }] }) // getEventListeners
      // Second element: regular button (includes getOuterHTML)
      .mockResolvedValueOnce({ attributes: ["class", "some-button"] }) // getAttributes
      .mockResolvedValueOnce({ outerHTML: "<button>Details</button>" }) // getOuterHTML
      .mockResolvedValueOnce({ object: { objectId: "obj2" } }) // resolveNode
      .mockResolvedValueOnce({ listeners: [{ type: "click" }] }) // getEventListeners
      // Third element: apply button (filtered by text, so no listeners checked)
      .mockResolvedValueOnce({ attributes: ["class", "apply-btn"] }) // getAttributes
      .mockResolvedValueOnce({ outerHTML: "<button>Apply Now</button>" }) // getOuterHTML
      // Marking phase (after sorting - job-detail buttons first)
      .mockResolvedValueOnce({}) // setAttributeValue element1 (data-clickable-id)
      .mockResolvedValueOnce({}) // setAttributeValue element1 (data-click-text)
      .mockResolvedValueOnce({}) // setAttributeValue element2 (data-clickable-id)
      .mockResolvedValueOnce({}); // setAttributeValue element2 (data-click-text)

    const count = await markClickableElementsInContainer(
      mockPage as unknown as Page,
      "body",
    );

    // Should find 2 clickable elements (job-description button + regular button)
    // Apply button should be filtered out
    expect(count).toBe(2);
    expect(mockClient.detach).toHaveBeenCalled();
  });

  it("should filter out navigation elements", async () => {
    mockClient.send
      .mockResolvedValueOnce({}) // DOM.enable
      .mockResolvedValueOnce({}) // DOMDebugger.enable
      .mockResolvedValueOnce({ root: { nodeId: 1 } })
      .mockResolvedValueOnce({ nodeId: 2 })
      .mockResolvedValueOnce({ nodeIds: [10] });

    // Navigation menu element
    mockClient.send
      .mockResolvedValueOnce({
        attributes: ["class", "nav-menu", "role", "navigation"],
      })
      .mockResolvedValueOnce({ object: { objectId: "obj1" } })
      .mockResolvedValueOnce({
        listeners: [{ type: "click" }],
      });

    const count = await markClickableElementsInContainer(
      mockPage as unknown as Page,
    );

    // Navigation element should be filtered
    expect(count).toBe(0);
  });

  it("should filter out external links", async () => {
    mockClient.send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ root: { nodeId: 1 } })
      .mockResolvedValueOnce({ nodeId: 2 })
      .mockResolvedValueOnce({ nodeIds: [10] });

    // External link
    mockClient.send
      .mockResolvedValueOnce({
        attributes: ["href", "https://example.com/external", "class", "link"],
      })
      .mockResolvedValueOnce({ object: { objectId: "obj1" } })
      .mockResolvedValueOnce({
        listeners: [{ type: "click" }],
      });

    const count = await markClickableElementsInContainer(
      mockPage as unknown as Page,
    );

    // External link should be filtered
    expect(count).toBe(0);
  });

  it("should preserve hash links and javascript: links", async () => {
    mockClient.send
      .mockResolvedValueOnce({}) // DOM.enable
      .mockResolvedValueOnce({}) // DOMDebugger.enable
      .mockResolvedValueOnce({ root: { nodeId: 1 } }) // getDocument
      .mockResolvedValueOnce({ nodeId: 2 }) // querySelector
      .mockResolvedValueOnce({ nodeIds: [10, 11] }) // querySelectorAll
      // Hash link
      .mockResolvedValueOnce({
        attributes: ["href", "#details", "class", "tab"],
      }) // getAttributes
      .mockResolvedValueOnce({ outerHTML: "<a>View</a>" }) // getOuterHTML
      .mockResolvedValueOnce({ object: { objectId: "obj1" } }) // resolveNode
      .mockResolvedValueOnce({ listeners: [{ type: "click" }] }) // getEventListeners
      // JavaScript link
      .mockResolvedValueOnce({
        attributes: ["href", "javascript:void(0)", "class", "action"],
      }) // getAttributes
      .mockResolvedValueOnce({ outerHTML: "<a>Action</a>" }) // getOuterHTML
      .mockResolvedValueOnce({ object: { objectId: "obj2" } }) // resolveNode
      .mockResolvedValueOnce({ listeners: [{ type: "click" }] }) // getEventListeners
      // Marking phase
      .mockResolvedValueOnce({}) // setAttributeValue element1 (data-clickable-id)
      .mockResolvedValueOnce({}) // setAttributeValue element1 (data-click-text)
      .mockResolvedValueOnce({}) // setAttributeValue element2 (data-clickable-id)
      .mockResolvedValueOnce({}); // setAttributeValue element2 (data-click-text)

    const count = await markClickableElementsInContainer(
      mockPage as unknown as Page,
    );

    // Both hash and javascript: links should be preserved
    expect(count).toBe(2);
  });

  it("should handle errors gracefully", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mockClient.send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("CDP error"));

    await expect(
      markClickableElementsInContainer(mockPage as unknown as Page),
    ).rejects.toThrow("CDP error");

    expect(mockClient.detach).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("should handle DOMDebugger.enable not available", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    mockClient.send
      .mockResolvedValueOnce({}) // DOM.enable
      .mockRejectedValueOnce(new Error("Protocol error")) // DOMDebugger.enable fails
      .mockResolvedValueOnce({ root: { nodeId: 1 } })
      .mockResolvedValueOnce({ nodeId: 2 })
      .mockResolvedValueOnce({ nodeIds: [] });

    const count = await markClickableElementsInContainer(
      mockPage as unknown as Page,
    );

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("DOMDebugger.enable not available"),
    );
    expect(count).toBe(0);
    consoleWarnSpy.mockRestore();
  });
});
