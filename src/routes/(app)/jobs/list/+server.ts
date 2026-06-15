import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSelectedProfileId } from "../../profile/utils";
import {
  JOB_LIST_PAGE_SIZE,
  listJobs,
  parseJobListFilters,
} from "$lib/server/job/list-jobs";

/**
 * GET /jobs/list — JSON page of jobs for infinite scroll on /jobs.
 * Takes the same query params as the /jobs page (filters + sort + page) and
 * returns the same shape, via the shared `listJobs`.
 */
export const GET: RequestHandler = async ({ url, locals, cookies }) => {
  const user = locals.user;
  if (!user) return json({ error: "Not authenticated" }, { status: 401 });

  const profileId = await getSelectedProfileId(cookies, user.id);
  if (!profileId) {
    return json({ error: "No profile selected" }, { status: 400 });
  }

  const filters = parseJobListFilters(url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = JOB_LIST_PAGE_SIZE;

  const { jobs, matchesByJobId, savedJobIds, rejectedJobIds, totalCount } =
    await listJobs(profileId, filters, page, limit);

  return json({
    jobs,
    matchesByJobId,
    savedJobIds,
    rejectedJobIds,
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / limit),
  });
};
