import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";

/**
 * PATCH /api/job-searches/[id]
 *
 * Update job search settings (e.g. max_jobs).
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  const jobSearchId = parseInt(params.id);
  if (isNaN(jobSearchId)) {
    throw error(400, "Invalid job search ID");
  }

  const jobSearch = await db.job_searches.findFirst({
    where: { id: jobSearchId },
    include: { profiles: true },
  });

  if (!jobSearch) {
    throw error(404, "Job search not found");
  }

  if (jobSearch.profiles.user_id !== user.id) {
    throw error(403, "Not authorized");
  }

  const body = await request.json();

  // Validate max_jobs: null (use default) or positive integer up to system max
  const data: { max_jobs?: number | null } = {};

  if ("max_jobs" in body) {
    if (body.max_jobs === null) {
      data.max_jobs = null;
    } else {
      const maxJobs = parseInt(body.max_jobs);
      if (isNaN(maxJobs) || maxJobs < 1) {
        throw error(400, "max_jobs must be a positive integer or null");
      }
      data.max_jobs = maxJobs;
    }
  }

  await db.job_searches.update({
    where: { id: jobSearchId },
    data,
  });

  return json({ ok: true });
};
