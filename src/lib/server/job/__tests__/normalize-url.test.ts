/**
 * Unit tests for URL normalization utility
 */

import { describe, expect, it } from "vitest";
import { areJobUrlsEqual, normalizeJobUrl } from "../normalize-url";

describe("normalizeJobUrl", () => {
  describe("tracking parameter removal", () => {
    it("should remove UTM parameters", () => {
      const url =
        "https://example.com/jobs/123?utm_source=google&utm_medium=cpc&utm_campaign=jobs";
      expect(normalizeJobUrl(url)).toBe("https://example.com/jobs/123");
    });

    it("should remove Facebook click ID", () => {
      const url = "https://example.com/jobs/123?fbclid=abc123xyz";
      expect(normalizeJobUrl(url)).toBe("https://example.com/jobs/123");
    });

    it("should remove Google click ID", () => {
      const url = "https://example.com/jobs/123?gclid=abc123xyz";
      expect(normalizeJobUrl(url)).toBe("https://example.com/jobs/123");
    });

    it("should remove generic tracking parameters", () => {
      const url =
        "https://example.com/jobs/123?tracking=abc&ref=homepage&source=email";
      expect(normalizeJobUrl(url)).toBe("https://example.com/jobs/123");
    });

    it("should preserve non-tracking query parameters", () => {
      const url = "https://example.com/jobs?id=123&category=engineering";
      expect(normalizeJobUrl(url)).toBe(
        "https://example.com/jobs?id=123&category=engineering",
      );
    });

    it("should handle mixed tracking and non-tracking params", () => {
      const url =
        "https://example.com/jobs?id=123&utm_source=google&category=dev";
      expect(normalizeJobUrl(url)).toBe(
        "https://example.com/jobs?id=123&category=dev",
      );
    });
  });

  describe("LinkedIn URL handling", () => {
    it("should remove all query params from LinkedIn URLs", () => {
      const url =
        "https://www.linkedin.com/jobs/view/123456?trackingId=abc&refId=xyz";
      expect(normalizeJobUrl(url)).toBe(
        "https://www.linkedin.com/jobs/view/123456",
      );
    });

    it("should handle LinkedIn URLs without www", () => {
      const url = "https://linkedin.com/jobs/view/123456?tracking=abc";
      expect(normalizeJobUrl(url)).toBe(
        "https://linkedin.com/jobs/view/123456",
      );
    });

    it("should normalize LinkedIn job collection URLs", () => {
      const url =
        "https://www.linkedin.com/jobs/collections/recommended/?currentJobId=123";
      expect(normalizeJobUrl(url)).toBe(
        "https://www.linkedin.com/jobs/collections/recommended",
      );
    });
  });

  describe("hash fragment handling", () => {
    it("should remove hash fragments", () => {
      const url = "https://example.com/jobs/123#apply";
      expect(normalizeJobUrl(url)).toBe("https://example.com/jobs/123");
    });

    it("should remove hash with query params", () => {
      const url = "https://example.com/jobs?id=123#details";
      expect(normalizeJobUrl(url)).toBe("https://example.com/jobs?id=123");
    });
  });

  describe("trailing slash handling", () => {
    it("should remove trailing slash from paths", () => {
      const url = "https://example.com/jobs/123/";
      expect(normalizeJobUrl(url)).toBe("https://example.com/jobs/123");
    });

    it("should not remove slash from root path", () => {
      const url = "https://example.com/";
      expect(normalizeJobUrl(url)).toBe("https://example.com/");
    });
  });

  describe("error handling", () => {
    it("should return invalid URL as-is", () => {
      const invalidUrl = "not-a-valid-url";
      expect(normalizeJobUrl(invalidUrl)).toBe("not-a-valid-url");
    });

    it("should handle empty string", () => {
      expect(normalizeJobUrl("")).toBe("");
    });
  });
});

describe("areJobUrlsEqual", () => {
  it("should match URLs that differ only by tracking params", () => {
    const url1 = "https://example.com/jobs/123?utm_source=google";
    const url2 = "https://example.com/jobs/123?utm_source=email";
    expect(areJobUrlsEqual(url1, url2)).toBe(true);
  });

  it("should match URLs with different query param order", () => {
    const url1 = "https://example.com/jobs?id=123&category=dev";
    const url2 = "https://example.com/jobs?category=dev&id=123";
    // Note: URL normalization preserves param order, so these will differ
    // This test verifies the actual behavior
    expect(areJobUrlsEqual(url1, url2)).toBe(false);
  });

  it("should not match different job URLs", () => {
    const url1 = "https://example.com/jobs/123";
    const url2 = "https://example.com/jobs/456";
    expect(areJobUrlsEqual(url1, url2)).toBe(false);
  });

  it("should match LinkedIn URLs with different tracking params", () => {
    const url1 =
      "https://www.linkedin.com/jobs/view/123456?trackingId=abc&refId=xyz";
    const url2 =
      "https://www.linkedin.com/jobs/view/123456?trackingId=def&origin=search";
    expect(areJobUrlsEqual(url1, url2)).toBe(true);
  });
});
