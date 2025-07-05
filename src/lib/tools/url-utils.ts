/**
 * Formats a project URL for display, removing protocol and www prefix
 * @param url - The full URL to format
 * @param urlLabel - Optional custom label; if not provided, derives from URL
 * @returns Object with isGithub flag and displayLabel
 */
export function formatProjectUrl(
  url: string,
  urlLabel?: string,
): { isGithub: boolean; displayLabel: string } {
  const isGithub = url.includes("github.com");

  if (urlLabel) {
    return { isGithub, displayLabel: urlLabel };
  }

  url = url
    .replace(/^https?:\/\/(www.)?/, "")
    .replace(/\/$/, "");

  if (isGithub) {
    if (!(url.match(/^.*\.github\.com/))) {
      url = url.replace("github.com/", "");
    }
  }

  return { isGithub, displayLabel: url };
}
