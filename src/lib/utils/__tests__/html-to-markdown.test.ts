import { describe, expect, it } from "vitest";
import {
  htmlToMarkdown,
  isLikelyHtml,
} from "$lib/utils/html-to-markdown";

describe("isLikelyHtml", () => {
  it("detects TipTap block/inline markup", () => {
    expect(isLikelyHtml("<h1>Me</h1><ul><li><p>x</p></li></ul>")).toBe(true);
    expect(isLikelyHtml("<p>hello</p>")).toBe(true);
  });

  it("treats plain text and markdown as non-HTML", () => {
    expect(isLikelyHtml("# Heading\n\n- a\n- b")).toBe(false);
    expect(isLikelyHtml("Just a sentence with a < b comparison")).toBe(false);
    expect(isLikelyHtml("")).toBe(false);
    expect(isLikelyHtml(null)).toBe(false);
  });
});

describe("htmlToMarkdown", () => {
  it("returns already-markdown content unchanged (idempotent path)", () => {
    const md = "## Topics\n\n- Point one\n- Point two";
    expect(htmlToMarkdown(md)).toBe(md);
  });

  it("converts headings and paragraphs", () => {
    expect(htmlToMarkdown("<h1>Me</h1><p>Some intro.</p>")).toBe(
      "# Me\n\nSome intro.",
    );
    expect(htmlToMarkdown("<h3>Chipta</h3>")).toBe("### Chipta");
  });

  it("converts a flat bullet list", () => {
    const html = "<ul><li><p>First</p></li><li><p>Second</p></li></ul>";
    expect(htmlToMarkdown(html)).toBe("- First\n- Second");
  });

  it("converts an ordered list", () => {
    const html = "<ol><li><p>One</p></li><li><p>Two</p></li></ol>";
    expect(htmlToMarkdown(html)).toBe("1. One\n2. Two");
  });

  it("indents nested lists", () => {
    const html =
      "<ul><li><p>Parent</p><ul><li><p>Child A</p></li><li><p>Child B</p></li></ul></li></ul>";
    expect(htmlToMarkdown(html)).toBe(
      "- Parent\n  - Child A\n  - Child B",
    );
  });

  it("converts inline bold, italic, and links", () => {
    expect(htmlToMarkdown("<p>a <strong>bold</strong> word</p>")).toBe(
      "a **bold** word",
    );
    expect(htmlToMarkdown("<p>an <em>italic</em> word</p>")).toBe(
      "an *italic* word",
    );
    expect(
      htmlToMarkdown('<p>see <a href="https://x.io">the site</a></p>'),
    ).toBe("see [the site](https://x.io)");
  });

  it("decodes entities", () => {
    expect(htmlToMarkdown("<p>Spain &amp; Portugal</p>")).toBe(
      "Spain & Portugal",
    );
  });

  it("handles a real multi-section cheat sheet with 2-level nesting", () => {
    const html =
      "<h1>Me</h1><ul><li><p>Live in Haarlem</p><ul><li><p>Good community</p></li>" +
      "<li><p>Born in Cruquius</p></li></ul></li></ul>" +
      "<h1>Experience</h1><ul><li><p>15+ years fullstack</p></li></ul><p></p>";
    const md = htmlToMarkdown(html);
    expect(md).toBe(
      [
        "# Me",
        "",
        "- Live in Haarlem",
        "  - Good community",
        "  - Born in Cruquius",
        "",
        "# Experience",
        "",
        "- 15+ years fullstack",
      ].join("\n"),
    );
    // No raw tags survive.
    expect(md).not.toMatch(/<[^>]+>/);
  });
});
