import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAuth } from "$lib/server/utils/api-helpers";
import { getErrorMessage } from "$lib/server/utils/errors";

/**
 * GET /api/platforms/fetch-metadata?url=...
 *
 * Fetch metadata (title, favicon) from a website URL.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  requireAuth(locals);

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

  // Extract domain info first (always available even if fetch fails)
  const parsedUrl = new URL(normalizedUrl);
  const domain = parsedUrl.hostname.replace(/^www\./, "");
  const fallbackName = domain;
  const fallbackKey = domain
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase();

  try {
    // Fetch the page with a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Sec-Ch-Ua":
          '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      // Return fallback data based on domain if fetch fails
      return json({
        url: normalizedUrl,
        domain,
        title: null,
        favicon: `${parsedUrl.origin}/favicon.ico`,
        suggestedName: fallbackName,
        suggestedKey: fallbackKey,
        fetchFailed: true,
      });
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

    return json({
      url: normalizedUrl,
      domain,
      title,
      favicon,
      suggestedName: title || fallbackName,
      suggestedKey: fallbackKey,
    });
  } catch (err) {
    // Return fallback data on any error
    return json({
      url: normalizedUrl,
      domain,
      title: null,
      favicon: `${parsedUrl.origin}/favicon.ico`,
      suggestedName: fallbackName,
      suggestedKey: fallbackKey,
      fetchFailed: true,
      error: getErrorMessage(err),
    });
  }
};
