import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  markClickableElementsInContainer,
  markSemanticElements,
} from "../cdp-utils";
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

describe("markSemanticElements", () => {
  let mockPage: any;
  let mockClient: any;
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = createMockCDPClient();

    const newCDPSession = vi.fn().mockResolvedValue(mockClient);
    mockContext = { newCDPSession };

    mockPage = {
      context: vi.fn(() => mockContext),
    };
  });

  it("should mark elements with semantic roles", async () => {
    const consoleLogSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    mockClient.send
      .mockResolvedValueOnce({}) // DOM.enable
      .mockResolvedValueOnce({ root: { nodeId: 1 } }) // DOM.getDocument
      // First role: job-title
      .mockResolvedValueOnce({ nodeIds: [10, 11] }) // DOM.querySelectorAll
      .mockResolvedValueOnce({}) // setAttributeValue node 10
      .mockResolvedValueOnce({}) // setAttributeValue node 11
      // Second role: company-name
      .mockResolvedValueOnce({ nodeIds: [20] }) // DOM.querySelectorAll
      .mockResolvedValueOnce({}); // setAttributeValue node 20

    const selectors = {
      "job-title": "h1.title",
      "company-name": ".company",
    };

    const result = await markSemanticElements(
      mockPage as unknown as Page,
      selectors,
    );

    expect(result.total).toBe(3);
    expect(result.byRole["job-title"]).toBe(2);
    expect(result.byRole["company-name"]).toBe(1);
    expect(mockClient.detach).toHaveBeenCalled();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Marked 2 element(s) as 'job-title'"),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Marked 1 element(s) as 'company-name'"),
    );

    consoleLogSpy.mockRestore();
  });

  it("should handle selector failures gracefully", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    mockClient.send
      .mockResolvedValueOnce({}) // DOM.enable
      .mockResolvedValueOnce({ root: { nodeId: 1 } }) // DOM.getDocument
      .mockRejectedValueOnce(new Error("Invalid selector")); // querySelectorAll fails

    const selectors = {
      "job-title": ".invalid[selector",
    };

    const result = await markSemanticElements(
      mockPage as unknown as Page,
      selectors,
    );

    expect(result.total).toBe(0);
    expect(result.byRole["job-title"]).toBe(0);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Selector failed for 'job-title'"),
    );
    expect(mockClient.detach).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it("should skip empty selectors", async () => {
    mockClient.send
      .mockResolvedValueOnce({}) // DOM.enable
      .mockResolvedValueOnce({ root: { nodeId: 1 } }) // DOM.getDocument
      .mockResolvedValueOnce({ nodeIds: [10] }) // querySelectorAll for valid selector
      .mockResolvedValueOnce({}); // setAttributeValue

    const selectors = {
      "job-title": "h1.title",
      "company-name": "", // Empty selector
    };

    const result = await markSemanticElements(
      mockPage as unknown as Page,
      selectors,
    );

    expect(result.total).toBe(1);
    expect(result.byRole["job-title"]).toBe(1);
    expect(result.byRole["company-name"]).toBeUndefined();
  });

  it("should handle setAttribute failures gracefully", async () => {
    const consoleDebugSpy = vi
      .spyOn(console, "debug")
      .mockImplementation(() => {});

    mockClient.send
      .mockResolvedValueOnce({}) // DOM.enable
      .mockResolvedValueOnce({ root: { nodeId: 1 } }) // DOM.getDocument
      .mockResolvedValueOnce({ nodeIds: [10, 11] }) // querySelectorAll
      .mockResolvedValueOnce({}) // setAttributeValue node 10 (success)
      .mockRejectedValueOnce(new Error("Node removed")); // setAttributeValue node 11 (failure)

    const selectors = {
      "job-title": "h1.title",
    };

    const result = await markSemanticElements(
      mockPage as unknown as Page,
      selectors,
    );

    // Should still count successful markings
    expect(result.total).toBe(1);
    expect(result.byRole["job-title"]).toBe(2); // nodeIds count, not successful marks
    expect(consoleDebugSpy).toHaveBeenCalled();

    consoleDebugSpy.mockRestore();
  });

  it("should handle CDP errors and detach client", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mockClient.send
      .mockResolvedValueOnce({}) // DOM.enable
      .mockRejectedValueOnce(new Error("CDP connection error")); // getDocument fails

    const selectors = {
      "job-title": "h1.title",
    };

    await expect(
      markSemanticElements(mockPage as unknown as Page, selectors),
    ).rejects.toThrow("CDP connection error");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "CDP semantic marking error:",
      expect.any(Error),
    );
    expect(mockClient.detach).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should not log when no elements are marked for a role", async () => {
    const consoleLogSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    mockClient.send
      .mockResolvedValueOnce({}) // DOM.enable
      .mockResolvedValueOnce({ root: { nodeId: 1 } }) // DOM.getDocument
      .mockResolvedValueOnce({ nodeIds: [] }); // querySelectorAll returns no elements

    const selectors = {
      "job-title": "h1.title",
    };

    const result = await markSemanticElements(
      mockPage as unknown as Page,
      selectors,
    );

    expect(result.total).toBe(0);
    expect(result.byRole["job-title"]).toBe(0);

    // Should not log when no elements found
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Marked"),
    );

    consoleLogSpy.mockRestore();
  });
});
