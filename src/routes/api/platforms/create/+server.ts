import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth } from "$lib/server/utils/api-helpers";

/**
 * POST /api/platforms/create
 *
 * Create a new platform (user-generated).
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  requireAuth(locals);

  const body = await request.json();
  const { url, name, loginPageUrl } = body;

  if (!url) {
    throw error(400, "URL is required");
  }

  // Normalize URL
  let normalizedUrl: string;
  let domain: string;
  try {
    normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
    const parsed = new URL(normalizedUrl);
    domain = parsed.hostname.replace(/^www\./, "");
    // Use just the origin as the platform URL
    normalizedUrl = parsed.origin;
  } catch {
    throw error(400, "Invalid URL");
  }

  // Check if platform already exists with this URL
  const existing = await db.job_platforms.findFirst({
    where: {
      OR: [
        { url: { contains: domain, mode: "insensitive" } },
        { key: domain.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]/gi, "-").toLowerCase() },
      ],
    },
  });

  if (existing) {
    // Return existing platform instead of creating duplicate
    return json({
      created: false,
      platform: {
        id: existing.id,
        name: existing.name,
        key: existing.key,
        url: existing.url,
        loginPageUrl: existing.login_page_url,
        status: existing.status,
      },
    });
  }

  // Generate unique key from domain
  let key = domain
    .replace(/\.[^.]+$/, "") // Remove TLD
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase();

  // Ensure key is unique
  const keyExists = await db.job_platforms.findFirst({
    where: { key },
  });

  if (keyExists) {
    // Append random suffix
    key = `${key}-${Date.now().toString(36)}`;
  }

  // Create new platform
  const platform = await db.job_platforms.create({
    data: {
      name: name || domain,
      url: normalizedUrl,
      key,
      login_page_url: loginPageUrl || null,
      status: "published", // User-created platforms are immediately available
      date_created: new Date(),
    },
  });

  return json({
    created: true,
    platform: {
      id: platform.id,
      name: platform.name,
      key: platform.key,
      url: platform.url,
      loginPageUrl: platform.login_page_url,
      status: platform.status,
    },
  });
};
