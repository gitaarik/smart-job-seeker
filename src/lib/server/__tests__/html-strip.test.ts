import { describe, expect, it } from "vitest";
import { stripHtmlForLlm } from "../html-strip";

describe("stripHtmlForLlm", () => {
  it("should remove script tags", () => {
    const html = `
      <html>
        <body>
          <p>Content</p>
          <script>alert('test');</script>
        </body>
      </html>
    `;

    const result = stripHtmlForLlm(html);

    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
    expect(result).toContain("Content");
  });

  it("should remove style tags", () => {
    const html = `
      <html>
        <head>
          <style>.test { color: red; }</style>
        </head>
        <body>
          <p>Content</p>
        </body>
      </html>
    `;

    const result = stripHtmlForLlm(html);

    expect(result).not.toContain("<style>");
    expect(result).not.toContain("color: red");
    expect(result).toContain("Content");
  });

  it("should remove head tag entirely", () => {
    const html = `
      <html>
        <head>
          <title>Test Page</title>
          <meta charset="utf-8">
        </head>
        <body>
          <p>Content</p>
        </body>
      </html>
    `;

    const result = stripHtmlForLlm(html);

    expect(result).not.toContain("<head>");
    expect(result).not.toContain("<title>");
    expect(result).not.toContain("<meta");
    expect(result).toContain("Content");
  });

  it("should remove HTML comments", () => {
    const html = `
      <html>
        <body>
          <!-- This is a comment -->
          <p>Content</p>
          <!-- Another comment -->
        </body>
      </html>
    `;

    const result = stripHtmlForLlm(html);

    expect(result).not.toContain("<!--");
    expect(result).not.toContain("comment");
    expect(result).toContain("Content");
  });

  it("should keep important attributes (href and type only)", () => {
    const html = `
      <html>
        <body>
          <a href="https://example.com" class="link" id="test">Link</a>
          <input type="email" name="email" class="input">
        </body>
      </html>
    `;

    const result = stripHtmlForLlm(html);

    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('type="email"');
    expect(result).not.toContain('class="link"');
    expect(result).not.toContain('id="test"');
    expect(result).not.toContain('name="email"');
  });

  it("should remove empty elements", () => {
    const html = `
      <html>
        <body>
          <div></div>
          <p>Content</p>
          <span></span>
          <div><span></span></div>
        </body>
      </html>
    `;

    const result = stripHtmlForLlm(html);

    expect(result).toContain("Content");
    // Empty divs and spans should be removed
    expect(result.match(/<div><\/div>/g)).toBeNull();
    expect(result.match(/<span><\/span>/g)).toBeNull();
  });

  it("should preserve self-closing tags (br, hr but not img)", () => {
    const html = `
      <html>
        <body>
          <p>Line 1<br>Line 2</p>
          <hr>
          <img src="test.jpg" alt="Test">
        </body>
      </html>
    `;

    const result = stripHtmlForLlm(html);

    expect(result).toContain("<br>");
    expect(result).toContain("<hr>");
    // Images are removed to save tokens
    expect(result).not.toContain("<img");
  });

  it("should normalize whitespace", () => {
    const html = `
      <html>
        <body>
          <p>
            Multiple    spaces    and
            newlines
          </p>
        </body>
      </html>
    `;

    const result = stripHtmlForLlm(html);

    // Should not have excessive whitespace
    expect(result).not.toMatch(/\s{2,}/);
    expect(result).toContain("Multiple spaces and newlines");
  });

  it("should remove SVG elements", () => {
    const html = `
      <html>
        <body>
          <p>Content</p>
          <svg><circle cx="50" cy="50" r="40"/></svg>
        </body>
      </html>
    `;

    const result = stripHtmlForLlm(html);

    expect(result).not.toContain("<svg>");
    expect(result).not.toContain("<circle");
    expect(result).toContain("Content");
  });

  it("should handle nested empty elements", () => {
    const html = `
      <html>
        <body>
          <div>
            <div>
              <div>
                <span></span>
              </div>
            </div>
          </div>
          <p>Content</p>
        </body>
      </html>
    `;

    const result = stripHtmlForLlm(html);

    expect(result).toContain("Content");
    // Nested empty elements should be cleaned up
    expect(result).not.toMatch(/<div>\s*<div>\s*<div>/);
  });

  it("should preserve elements with text content", () => {
    const html = `
      <html>
        <body>
          <div>
            <h1>Title</h1>
            <p>Paragraph 1</p>
            <p>Paragraph 2</p>
          </div>
        </body>
      </html>
    `;

    const result = stripHtmlForLlm(html);

    expect(result).toContain("Title");
    expect(result).toContain("Paragraph 1");
    expect(result).toContain("Paragraph 2");
    expect(result).toContain("<h1>");
    expect(result).toContain("<p>");
  });

  it("should remove aria-label attribute (not in keeplist)", () => {
    const html = `
      <html>
        <body>
          <button aria-label="Close dialog" class="btn">X</button>
        </body>
      </html>
    `;

    const result = stripHtmlForLlm(html);

    // Only href and type attributes are kept
    expect(result).not.toContain('aria-label="Close dialog"');
    expect(result).not.toContain('class="btn"');
    expect(result).toContain("X"); // Content should remain
  });

  it("should handle complex real-world HTML", () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Job Listing</title>
          <style>.job { margin: 20px; }</style>
        </head>
        <body>
          <header class="site-header">
            <nav id="main-nav">
              <a href="/">Home</a>
            </nav>
          </header>
          <main>
            <article class="job-posting">
              <h1>Software Engineer</h1>
              <div class="company">
                <span>Company Name</span>
              </div>
              <div class="description">
                <p>Job description here</p>
              </div>
            </article>
          </main>
          <script src="analytics.js"></script>
        </body>
      </html>
    `;

    const result = stripHtmlForLlm(html);

    expect(result).toContain("Software Engineer");
    expect(result).toContain("Company Name");
    expect(result).toContain("Job description here");
    // Header and nav are removed, so href is not present
    expect(result).not.toContain('href="/"');
    expect(result).not.toContain("charset");
    expect(result).not.toContain("class=");
    expect(result).not.toContain("id=");
    expect(result).not.toContain("<script");
    expect(result).not.toContain("<style");
    expect(result).not.toContain("<header");
    expect(result).not.toContain("<nav");
  });
});
