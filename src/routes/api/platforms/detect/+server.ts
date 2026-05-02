import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, eq, ilike, isNotNull, or } from "drizzle-orm";
import {
  job_platforms,
  platform_profiles,
  profiles,
} from "$lib/server/db/schema";
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
  const profile = await db.query.profiles.findFirst({
    where: and(
      eq(profiles.id, parseInt(profileId)),
      eq(profiles.user_id, user.id),
    ),
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

  // Build domain candidates from most specific to least, dropping leading
  // subdomain labels. For "nl.indeed.com" this yields
  // ["nl.indeed.com", "indeed.com"], so country-code subdomains still match a
  // platform registered with the bare domain. We stop before the bare TLD to
  // avoid matching every .nl or .com platform.
  const labels = domain.split(".");
  const domainCandidates: string[] = [];
  for (let i = 0; i < Math.max(labels.length - 1, 1); i++) {
    domainCandidates.push(labels.slice(i).join("."));
  }

  const existingPlatform = await db.query.job_platforms.findFirst({
    where: or(
      ...domainCandidates.map((d) => ilike(job_platforms.url, `%${d}%`)),
    ),
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
    const platformProfiles = await db.query.platform_profiles.findMany({
      where: and(
        eq(platform_profiles.platform_id, existingPlatform.id),
        eq(platform_profiles.profile_id, profile.id),
        isNotNull(platform_profiles.username),
      ),
      columns: {
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
        `${url.origin}/api/platforms/fetch-metadata?url=${
          encodeURIComponent(baseUrl)
        }`,
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
