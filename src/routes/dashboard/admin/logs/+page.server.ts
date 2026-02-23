import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.user) {
    redirect(302, "/login");
  }

  // Check admin status
  const dbUser = await db.users.findUnique({
    where: { id: layoutData.user.id },
    select: { is_admin: true },
  });

  if (!dbUser?.is_admin) {
    throw error(403, "Admin access required");
  }

  // Get list of job searches for filter dropdown
  const jobSearches = await db.job_searches.findMany({
    select: {
      id: true,
      name: true,
      status: true,
    },
    orderBy: { date_updated: "desc" },
    take: 50,
  });

  // Get initial logs (via run -> job_search relation)
  const logs = await db.scraper_logs.findMany({
    orderBy: { timestamp: "desc" },
    take: 100,
    include: {
      run: {
        select: {
          id: true,
          job_search_id: true,
          job_searches: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return {
    jobSearches,
    initialLogs: logs.reverse().map((log) => ({
      id: log.id,
      level: log.level,
      message: log.message,
      timestamp: log.timestamp.toISOString(),
      runId: log.run_id,
      jobSearchId: log.run?.job_search_id,
      jobSearchName: log.run?.job_searches?.name,
    })),
  };
};
