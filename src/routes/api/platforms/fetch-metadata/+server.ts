import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * GET /api/platforms/fetch-metadata?url=...
 *
 * Fetch metadata (title, favicon) from a website URL.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  const targetUrl = url.searchParams.get("url");
  if (!targetUrl) {
    throw error(400, "URL parameter required");
  }

  // Normalize URL
  let normalizedUrl: string;
  try {
    normalizedUrl = targetUrl.startsWith("http")
      ? targetUrl
      : `https://${targetUrl}`;
    new URL(normalizedUrl); // Validate URL
  } catch {
    throw error(400, "Invalid URL");
  }

  try {
    // Fetch the page with a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SmartJobSeeker/1.0; +https://smartjobseeker.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw error(400, `Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : null;

    // Clean up title - remove common suffixes
    if (title) {
      title = title
        .replace(/\s*[-|–—]\s*(Home|Homepage|Jobs|Careers|Welcome).*$/i, "")
        .replace(/\s*[-|–—]\s*Find.*$/i, "")
        .trim();
    }

    // Try to get og:title as fallback
    if (!title) {
      const ogTitleMatch = html.match(
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      );
      title = ogTitleMatch ? ogTitleMatch[1].trim() : null;
    }

    // Extract favicon
    let favicon: string | null = null;

    // Look for favicon link
    const faviconMatch = html.match(
      /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
    );
    if (faviconMatch) {
      favicon = faviconMatch[1];
    } else {
      // Try alternate format
      const altFaviconMatch = html.match(
        /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i,
      );
      if (altFaviconMatch) {
        favicon = altFaviconMatch[1];
      }
    }

    // Resolve relative favicon URLs
    if (favicon && !favicon.startsWith("http")) {
      const baseUrl = new URL(normalizedUrl);
      if (favicon.startsWith("//")) {
        favicon = `${baseUrl.protocol}${favicon}`;
      } else if (favicon.startsWith("/")) {
        favicon = `${baseUrl.origin}${favicon}`;
      } else {
        favicon = `${baseUrl.origin}/${favicon}`;
      }
    }

    // Fallback to default favicon location
    if (!favicon) {
      const baseUrl = new URL(normalizedUrl);
      favicon = `${baseUrl.origin}/favicon.ico`;
    }

    // Extract domain for key generation
    const parsedUrl = new URL(normalizedUrl);
    const domain = parsedUrl.hostname.replace(/^www\./, "");

    return json({
      url: normalizedUrl,
      domain,
      title,
      favicon,
      suggestedName: title || domain,
      suggestedKey: domain
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-z0-9]/gi, "-")
        .toLowerCase(),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw error(408, "Request timeout");
    }
    throw error(500, `Failed to fetch metadata: ${err}`);
  }
};
