import { describe, expect, it } from "vitest";
import { stripHtmlForLlm } from "../html/strip";

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

  it("should keep important attributes (href) and remove form elements", () => {
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
    // Input elements are now removed (form elements are noise for job scraping)
    expect(result).not.toContain('type="email"');
    expect(result).not.toContain("<input");
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
    // Whitelisted classes are preserved (job, company, title patterns)
    expect(result).toContain('class="job-posting"');
    expect(result).toContain('class="company"');
    expect(result).not.toContain("id=");
    expect(result).not.toContain("<script");
    expect(result).not.toContain("<style");
    expect(result).not.toContain("<header");
    expect(result).not.toContain("<nav");
  });

  it("should preserve data-xxx attributes for clickable markers", () => {
    const html = `
      <html>
        <body>
          <div class="title">Senior Engineer</div>
          <div id="company">Acme Corp</div>
          <div data-xxx="1">View Details</div>
          <div data-other-attribute="value" class="other">Some content</div>
        </body>
      </html>
    `;

    const result = stripHtmlForLlm(html);

    // data-xxx attribute should be preserved (clickable marker)
    expect(result).toContain('data-xxx="1"');

    // Other data attributes should be removed
    expect(result).not.toContain("data-other-attribute");
    expect(result).not.toContain('id="company"');

    // Whitelisted class preserved, non-whitelisted class removed
    expect(result).toContain('class="title"'); // "title" is whitelisted
    expect(result).not.toContain('class="other"'); // "other" is not whitelisted

    // Content should be preserved
    expect(result).toContain("Senior Engineer");
    expect(result).toContain("Acme Corp");
    expect(result).toContain("View Details");
    expect(result).toContain("Some content");
  });

  it("should preserve whitelisted class names for LLM context", () => {
    const html = `
      <html>
        <body>
          <div class="jobs-search-results__list ember-view pv2">
            <div class="artdeco-card job-card entity-result">
              <h3 class="job-title text-heading">Software Engineer</h3>
              <span class="company-name t-14">Acme Corp</span>
              <span class="location remote">San Francisco, CA</span>
              <span class="salary-range compensation">$100k - $150k</span>
            </div>
            <div class="random-class xyz-component">Other content</div>
          </div>
        </body>
      </html>
    `;

    const result = stripHtmlForLlm(html);

    // Job-related classes preserved
    expect(result).toContain("job-card");
    expect(result).toContain("job-title");
    expect(result).toContain("jobs-search-results__list");

    // Company/employer classes preserved
    expect(result).toContain("company-name");

    // Location classes preserved
    expect(result).toContain("location");
    expect(result).toContain("remote");

    // Salary classes preserved
    expect(result).toContain("salary-range");
    expect(result).toContain("compensation");

    // Structure classes preserved
    expect(result).toContain("artdeco-card");
    expect(result).toContain("result");

    // Title/heading classes preserved
    expect(result).toContain("heading");
    expect(result).toContain("title");

    // Non-whitelisted classes removed (no whitelist pattern match)
    expect(result).not.toContain("ember-view");
    expect(result).not.toContain("pv2");
    expect(result).not.toContain("t-14"); // LinkedIn typography class
    expect(result).not.toContain("random-class");
    expect(result).not.toContain("xyz-component");

    // Content preserved
    expect(result).toContain("Software Engineer");
    expect(result).toContain("Acme Corp");
    expect(result).toContain("San Francisco, CA");
    expect(result).toContain("$100k - $150k");
    expect(result).toContain("Other content");
  });

  describe("discovery mode (keepFormElements + keepNavigation)", () => {
    it("preserves an <input> nested inside structural divs (regression for LinkedIn job search box)", () => {
      // Mirrors the LinkedIn /jobs/ DOM that broke discovery run 29: the
      // search input sits many empty-div levels deep inside a <header>.
      const html = `
        <html>
          <body>
            <header>
              <div><div><div><div>
                <input
                  id=":r2:"
                  placeholder="Describe the job you want"
                  data-xxx="52"
                  value=""
                >
              </div></div></div></div>
            </header>
          </body>
        </html>
      `;

      const result = stripHtmlForLlm(html, {
        keepFormElements: true,
        keepNavigation: true,
      });

      expect(result).toContain("<input");
      expect(result).toContain('data-xxx="52"');
      expect(result).toContain("Describe the job you want");
    });

    it("preserves identifying input attributes (placeholder, name, aria-label)", () => {
      const html = `
        <form>
          <input name="q" placeholder="Search jobs" aria-label="Keywords" data-xxx="1">
          <input name="l" placeholder="City, state, or zip" aria-label="Location" data-xxx="2">
          <button data-xxx="3">Search</button>
        </form>
      `;

      const result = stripHtmlForLlm(html, { keepFormElements: true });

      expect(result).toContain('name="q"');
      expect(result).toContain('placeholder="Search jobs"');
      expect(result).toContain('aria-label="Keywords"');
      expect(result).toContain('placeholder="City, state, or zip"');
    });

    it("default mode still strips form elements (no regression for extraction)", () => {
      const html = `
        <body>
          <form>
            <input name="q" placeholder="Search">
          </form>
          <p>Job listing</p>
        </body>
      `;

      const result = stripHtmlForLlm(html);

      expect(result).not.toContain("<input");
      expect(result).not.toContain("<form");
      expect(result).toContain("Job listing");
    });

    it("keepNavigation preserves header and nav elements", () => {
      const html = `
        <body>
          <header><div><a href="/home" data-xxx="1">Home</a></div></header>
          <nav><a href="/jobs" data-xxx="2">Jobs</a></nav>
          <main><p>Main content</p></main>
        </body>
      `;

      const result = stripHtmlForLlm(html, { keepNavigation: true });

      expect(result).toContain("<header");
      expect(result).toContain("<nav");
      expect(result).toContain('data-xxx="1"');
      expect(result).toContain('data-xxx="2"');
    });
  });
});
