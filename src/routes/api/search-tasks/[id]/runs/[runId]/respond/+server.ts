import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";

/**
 * Valid user responses for scraper feedback
 */
const VALID_RESPONSES = ["continue", "skip", "cancel"] as const;
type UserResponse = (typeof VALID_RESPONSES)[number];

/**
 * POST /api/search-tasks/[id]/runs/[runId]/respond
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
  const user = requireAuth(locals);
  const searchTaskId = parseIntParam(params.id, "job search");
  const runId = parseIntParam(params.runId, "run");

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
  const searchTask = await db.search_tasks.findFirst({
    where: { id: searchTaskId },
    include: {
      profiles: true,
    },
  });

  if (!searchTask) {
    throw error(404, "Job search not found");
  }

  if (searchTask.profiles.user_id !== user.id) {
    throw error(403, "Not authorized");
  }

  // Get the run and verify it belongs to this job search
  const run = await db.search_task_runs.findFirst({
    where: {
      id: runId,
      search_task_id: searchTaskId,
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
  await db.search_task_runs.update({
    where: { id: runId },
    data: {
      user_response: response,
      // If cancelling, also update status immediately
      ...(response === "cancel" ? { status: "cancelled" } : {}),
    },
  });

  // If cancelling, also update the search_tasks table
  if (response === "cancel") {
    await db.search_tasks.update({
      where: { id: searchTaskId },
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
