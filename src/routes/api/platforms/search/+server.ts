import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";

/**
 * GET /api/platforms/search?url=...
 *
 * Search for existing platforms by URL (domain matching).
 * Returns matching platforms for autocomplete.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  const searchUrl = url.searchParams.get("url");
  if (!searchUrl) {
    throw error(400, "URL parameter required");
  }

  // Extract domain from URL
  let domain: string;
  try {
    const parsed = new URL(
      searchUrl.startsWith("http") ? searchUrl : `https://${searchUrl}`,
    );
    domain = parsed.hostname.replace(/^www\./, "");
  } catch {
    // If URL parsing fails, use as-is for searching
    domain = searchUrl.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
  }

  // Search for platforms matching the domain
  const platforms = await db.job_platforms.findMany({
    where: {
      OR: [
        { url: { contains: domain, mode: "insensitive" } },
        { name: { contains: domain, mode: "insensitive" } },
      ],
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      key: true,
      url: true,
      login_page_url: true,
      status: true,
    },
    take: 10,
  });

  return json(platforms);
};
