import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";

/**
 * Valid user responses for scraper feedback
 */
const VALID_RESPONSES = ["continue", "skip", "cancel"] as const;
type UserResponse = (typeof VALID_RESPONSES)[number];

/**
 * POST /api/job-searches/[id]/runs/[runId]/respond
 *
 * Submit user feedback to a running scraper job.
 * The scraper polls for this response during intervention waits.
 *
 * Body: { response: "continue" | "skip" | "cancel" }
 *
 * - continue: Proceed with the current action (e.g., after solving CAPTCHA)
 * - skip: Skip the current page/action and move to next
 * - cancel: Cancel the entire scraping run
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  const jobSearchId = parseInt(params.id);
  const runId = parseInt(params.runId);

  if (isNaN(jobSearchId) || isNaN(runId)) {
    throw error(400, "Invalid job search ID or run ID");
  }

  // Parse and validate request body
  let body: { response?: string };
  try {
    body = await request.json();
  } catch {
    throw error(400, "Invalid JSON body");
  }

  const response = body.response;
  if (!response || !VALID_RESPONSES.includes(response as UserResponse)) {
    throw error(400, `Invalid response. Must be one of: ${VALID_RESPONSES.join(", ")}`);
  }

  // Get the job search and verify ownership
  const jobSearch = await db.job_searches.findFirst({
    where: { id: jobSearchId },
    include: {
      profiles: true,
    },
  });

  if (!jobSearch) {
    throw error(404, "Job search not found");
  }

  if (jobSearch.profiles.user_id !== user.id) {
    throw error(403, "Not authorized");
  }

  // Get the run and verify it belongs to this job search
  const run = await db.job_search_runs.findFirst({
    where: {
      id: runId,
      job_search_id: jobSearchId,
    },
  });

  if (!run) {
    throw error(404, "Run not found");
  }

  // Check if run is in a state that accepts feedback
  if (!["running", "blocked"].includes(run.status)) {
    throw error(400, `Run is not active (status: ${run.status})`);
  }

  // Update the run with the user's response
  await db.job_search_runs.update({
    where: { id: runId },
    data: {
      user_response: response,
      // If cancelling, also update status immediately
      ...(response === "cancel" ? { status: "cancelled" } : {}),
    },
  });

  // If cancelling, also update the job_searches table
  if (response === "cancel") {
    await db.job_searches.update({
      where: { id: jobSearchId },
      data: {
        status: "cancelled",
        status_message: "Cancelled by user",
      },
    });
  }

  return json({
    success: true,
    response,
    message: response === "cancel"
      ? "Run cancelled"
      : `Response "${response}" recorded. The scraper will pick it up shortly.`,
  });
};
