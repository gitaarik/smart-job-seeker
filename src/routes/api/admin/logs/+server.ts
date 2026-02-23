import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";

/**
 * GET /api/admin/logs
 *
 * Get scraper logs for admin users.
 * Supports filtering by job_search_id and pagination.
 *
 * Query params:
 * - jobSearchId: Filter by job search (optional)
 * - limit: Max logs to return (default 100, max 500)
 * - since: Only return logs after this timestamp (ISO string)
 */
export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  // Check admin status
  const dbUser = await db.users.findUnique({
    where: { id: user.id },
    select: { is_admin: true },
  });

  if (!dbUser?.is_admin) {
    throw error(403, "Admin access required");
  }

  // Parse query params
  const jobSearchIdParam = url.searchParams.get("jobSearchId");
  const jobSearchId = jobSearchIdParam ? parseInt(jobSearchIdParam) : undefined;

  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(parseInt(limitParam || "100"), 500);

  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : undefined;

  // Build query
  const where: {
    job_search_id?: number | null;
    timestamp?: { gt: Date };
  } = {};

  if (jobSearchId !== undefined) {
    where.job_search_id = jobSearchId;
  }

  if (since) {
    where.timestamp = { gt: since };
  }

  const logs = await db.scraper_logs.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: limit,
    include: {
      job_searches: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Return in chronological order
  return json({
    logs: logs.reverse().map((log) => ({
      id: log.id,
      level: log.level,
      message: log.message,
      timestamp: log.timestamp.toISOString(),
      jobSearchId: log.job_search_id,
      jobSearchName: log.job_searches?.name,
    })),
  });
};

/**
 * DELETE /api/admin/logs
 *
 * Clear logs. Admin only.
 *
 * Query params:
 * - jobSearchId: Clear logs for specific job search (optional, clears all if not provided)
 */
export const DELETE: RequestHandler = async ({ url, locals }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  // Check admin status
  const dbUser = await db.users.findUnique({
    where: { id: user.id },
    select: { is_admin: true },
  });

  if (!dbUser?.is_admin) {
    throw error(403, "Admin access required");
  }

  const jobSearchIdParam = url.searchParams.get("jobSearchId");
  const jobSearchId = jobSearchIdParam ? parseInt(jobSearchIdParam) : undefined;

  if (jobSearchId !== undefined) {
    await db.scraper_logs.deleteMany({
      where: { job_search_id: jobSearchId },
    });
  } else {
    await db.scraper_logs.deleteMany({});
  }

  return json({ success: true });
};
