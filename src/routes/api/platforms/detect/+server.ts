import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth } from "$lib/server/utils/api-helpers";

/**
 * GET /api/platforms/detect?url=...&profileId=...
 *
 * Detect platform from URL and return existing credentials for that platform.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = requireAuth(locals);

  const targetUrl = url.searchParams.get("url");
  const profileId = url.searchParams.get("profileId");

  if (!targetUrl) {
    throw error(400, "URL parameter required");
  }

  if (!profileId) {
    throw error(400, "Profile ID required");
  }

  // Verify user owns this profile
  const profile = await db.profiles.findFirst({
    where: {
      id: parseInt(profileId),
      user_id: user.id,
    },
  });

  if (!profile) {
    throw error(403, "Not authorized");
  }

  // Extract domain from URL
  let domain: string;
  let baseUrl: string;
  try {
    const parsed = new URL(
      targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`,
    );
    domain = parsed.hostname.replace(/^www\./, "");
    baseUrl = parsed.origin;
  } catch {
    throw error(400, "Invalid URL");
  }

  // Try to find existing platform by URL/domain
  const existingPlatform = await db.job_platforms.findFirst({
    where: {
      OR: [
        { url: { contains: domain, mode: "insensitive" } },
        { key: { contains: domain.split(".")[0], mode: "insensitive" } },
      ],
    },
  });

  let platform: {
    id: number | null;
    name: string;
    url: string;
    loginPageUrl: string | null;
    isNew: boolean;
  };

  let credentials: Array<{
    id: number;
    username: string | null;
    status: string;
  }> = [];

  if (existingPlatform) {
    platform = {
      id: existingPlatform.id,
      name: existingPlatform.name,
      url: existingPlatform.url,
      loginPageUrl: existingPlatform.login_page_url,
      isNew: false,
    };

    // Get existing credentials for this platform and profile
    const platformProfiles = await db.platform_profiles.findMany({
      where: {
        platform: existingPlatform.id,
        profile: profile.id,
        username: { not: null },
      },
      select: {
        id: true,
        username: true,
        status: true,
      },
    });

    credentials = platformProfiles;
  } else {
    // New platform - try to fetch metadata
    let suggestedName = domain;

    try {
      const metadataResponse = await fetch(
        `${url.origin}/api/platforms/fetch-metadata?url=${encodeURIComponent(baseUrl)}`,
        {
          headers: {
            Cookie: url.searchParams.get("cookie") || "",
          },
        },
      );

      if (metadataResponse.ok) {
        const metadata = await metadataResponse.json();
        if (metadata.suggestedName) {
          suggestedName = metadata.suggestedName;
        }
      }
    } catch {
      // Use domain as fallback
    }

    platform = {
      id: null,
      name: suggestedName,
      url: baseUrl,
      loginPageUrl: null,
      isNew: true,
    };
  }

  return json({
    platform,
    credentials,
  });
};
