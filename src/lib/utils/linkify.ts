/**
 * Convert URLs in plain text to clickable HTML links.
 * Returns an HTML string — use with {@html linkify(text)}.
 * The text is HTML-escaped first to prevent XSS.
 */
export function linkify(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return escaped.replace(
    /https?:\/\/[^\s<>"')\]]+/g,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-[var(--dash-primary)] hover:underline">${url}</a>`,
  );
}
