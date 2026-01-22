import { describe, expect, it } from "vitest";
import { extractLinks } from "../html/extract";

describe("extractLinks", () => {
  it("should extract all links from HTML", () => {
    const html = `
      <html>
        <body>
          <a href="https://example.com">Link 1</a>
          <a href="https://test.com">Link 2</a>
          <a href="/relative">Link 3</a>
        </body>
      </html>
    `;

    const links = extractLinks(html);

    expect(links).toEqual([
      "https://example.com",
      "https://test.com",
      "/relative",
    ]);
  });

  it("should filter links by pattern", () => {
    const html = `
      <html>
        <body>
          <a href="https://example.com/job/123">Job 1</a>
          <a href="https://example.com/job/456">Job 2</a>
          <a href="https://example.com/about">About</a>
        </body>
      </html>
    `;

    const links = extractLinks(html, /\/job\//);

    expect(links).toEqual([
      "https://example.com/job/123",
      "https://example.com/job/456",
    ]);
  });

  it("should return unique links only", () => {
    const html = `
      <html>
        <body>
          <a href="https://example.com">Link 1</a>
          <a href="https://example.com">Link 1 duplicate</a>
          <a href="https://test.com">Link 2</a>
        </body>
      </html>
    `;

    const links = extractLinks(html);

    expect(links).toEqual(["https://example.com", "https://test.com"]);
  });

  it("should skip anchors without href", () => {
    const html = `
      <html>
        <body>
          <a>No href</a>
          <a href="">Empty href</a>
          <a href="https://example.com">Valid link</a>
        </body>
      </html>
    `;

    const links = extractLinks(html);

    expect(links).toEqual(["https://example.com"]);
  });

  it("should return empty array for HTML with no links", () => {
    const html = `
      <html>
        <body>
          <p>No links here</p>
        </body>
      </html>
    `;

    const links = extractLinks(html);

    expect(links).toEqual([]);
  });

  it("should handle malformed HTML gracefully", () => {
    const html = `
      <div>
        <a href="https://example.com">Link
        <p>Some text</p>
      </div>
    `;

    const links = extractLinks(html);

    expect(links).toEqual(["https://example.com"]);
  });

  it("should extract links with query parameters", () => {
    const html = `
      <html>
        <body>
          <a href="https://example.com?page=1&sort=date">Link 1</a>
          <a href="https://example.com?id=123#section">Link 2</a>
        </body>
      </html>
    `;

    const links = extractLinks(html);

    expect(links).toEqual([
      "https://example.com?page=1&sort=date",
      "https://example.com?id=123#section",
    ]);
  });
});
