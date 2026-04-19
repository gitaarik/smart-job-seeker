/**
 * Run Items API
 *
 * GET /api/import-tasks/[id]/runs/[runId]/items
 * Returns the list of jobs discovered during a scraper run with their processing status.
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, asc } from "drizzle-orm";
import { search_task_runs, search_task_run_items } from "$lib/server/db/schema";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";

export const GET: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  const searchTaskId = parseIntParam(params.id, "job search");
  const runId = parseIntParam(params.runId, "run");

  // Verify the run belongs to this job search and the user owns it
  const run = await db.query.search_task_runs.findFirst({
    where: and(
      eq(search_task_runs.id, runId),
      eq(search_task_runs.search_task_id, searchTaskId),
    ),
    columns: { id: true },
    with: {
      search_task: {
        with: {
          profile: { columns: { user_id: true } },
        },
      },
    },
  });

  if (!run || run.search_task.profile.user_id !== user.id) {
    throw error(404, "Run not found");
  }

  // Get all items for this run with job details for completed items
  const items = await db.query.search_task_run_items.findMany({
    where: eq(search_task_run_items.run_id, runId),
    orderBy: asc(search_task_run_items.position),
    columns: {
      id: true,
      position: true,
      clickable_id: true,
      title: true,
      company: true,
      location: true,
      status: true,
      status_message: true,
      job_id: true,
      was_created: true,
      created_at: true,
      processed_at: true,
    },
    with: {
      job: {
        columns: {
          id: true,
          title: true,
          company: true,
          office_location: true,
          salary_min: true,
          salary_max: true,
          salary_currency: true,
          salary_period: true,
          job_types: true,
          work_location: true,
          skills_required: true,
          skills_preferred: true,
          job_description: true,
          source_url: true,
        },
      },
    },
  });

  // Get summary stats
  const statusCounts = items.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const newCount = items.filter((i) => i.was_created === true).length;
  const existingCount = items.filter((i) => i.was_created === false && i.status === "completed").length;

  return json({
    items,
    stats: {
      total: items.length,
      pending: statusCounts["pending"] || 0,
      processing: statusCounts["processing"] || 0,
      completed: statusCounts["completed"] || 0,
      skipped: statusCounts["skipped"] || 0,
      error: statusCounts["error"] || 0,
      new: newCount,
      existing: existingCount,
    },
  });
};
