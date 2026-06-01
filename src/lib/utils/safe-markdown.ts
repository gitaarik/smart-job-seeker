/**
 * Render untrusted markdown (e.g. LLM output) to HTML safe for `{@html ...}`.
 *
 * Scraped/LLM-generated text can contain raw HTML and dangerous URL schemes.
 * `marked`'s default renderer passes raw HTML through verbatim, so feeding its
 * output straight into `{@html}` is an XSS sink. This module uses an isolated
 * `Marked` instance (so other `marked()` call sites are unaffected) that:
 *   - escapes any raw HTML tokens to inert text, and
 *   - drops `javascript:`/`data:`/`vbscript:` URLs from links and images.
 *
 * Markdown formatting (bold, lists, code, http(s) links) still renders.
 */
import { Marked, type Tokens } from "marked";

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(href: string | null | undefined): string | null {
  if (!href) return null;
  const scheme = href.trim().toLowerCase();
  if (
    scheme.startsWith("javascript:") ||
    scheme.startsWith("data:") ||
    scheme.startsWith("vbscript:")
  ) {
    return null;
  }
  return href;
}

const md = new Marked({
  renderer: {
    // Raw HTML (block + inline) → escaped text, never live markup.
    html(token: { text?: string; raw?: string } | string) {
      const raw = typeof token === "string"
        ? token
        : token.raw ?? token.text ?? "";
      return escapeHtml(raw);
    },
    link(token: Tokens.Link) {
      const href = safeUrl(token.href);
      // Render the link's inner content through this same instance so any raw
      // HTML in the link text is escaped by the `html` renderer above (`this`
      // is the active renderer, contextually typed by marked).
      const inner = this.parser.parseInline(token.tokens);
      if (!href) return inner;
      return `<a href="${
        escapeHtml(href)
      }" target="_blank" rel="noopener noreferrer">${inner}</a>`;
    },
    image(token: { href?: string; text?: string }) {
      const href = safeUrl(token.href);
      if (!href) return escapeHtml(token.text ?? "");
      return `<img src="${escapeHtml(href)}" alt="${
        escapeHtml(token.text ?? "")
      }">`;
    },
  },
});

/** Parse untrusted markdown into XSS-safe HTML. */
export function renderSafeMarkdown(markdown: string): string {
  return md.parse(markdown, { async: false }) as string;
}
