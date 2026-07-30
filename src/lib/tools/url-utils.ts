/**
 * Formats a project URL for display, removing protocol and www prefix
 * @param url - The full URL to format
 * @returns Object with isGithub flag and displayLabel
 */
export function formatProjectUrl(
  url: string,
): { isGithub: boolean; displayLabel: string } {
  const isGithub = url.includes("github.com");

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
