/**
 * Admin Scraper Agent API
 *
 * GET  - List all scraper agent sessions
 * POST - Create a new session
 */

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth } from "$lib/server/utils/api-helpers";
import { searchTaskDisplayName } from "$lib/format";

export const GET: RequestHandler = async ({ locals }) => {
  const user = requireAuth(locals);
  if (!(user as { is_admin?: boolean }).is_admin) {
    throw error(403, "Admin access required");
  }

  const sessions = await db.scraper_agent_sessions.findMany({
    orderBy: { created_at: "desc" },
    include: {
      search_tasks: {
        select: {
          id: true,
          note: true,
          search_url: true,
          platform: true,
          browser_provider: true,
          job_platforms: { select: { name: true } },
        },
      },
      iterations: {
        orderBy: { iteration: "desc" },
        take: 1,
        select: {
          iteration: true,
          stage: true,
          success_pct: true,
          run_id: true,
          run_status: true,
          goal_met: true,
          finished_at: true,
        },
      },
    },
  });

  // For sessions with blocked runs, fetch the blocked reason
  const blockedRunIds = sessions
    .filter((s) => s.iterations[0]?.stage === "blocked" && s.iterations[0]?.run_id)
    .map((s) => s.iterations[0].run_id!);

  const blockedRuns = blockedRunIds.length > 0
    ? await db.search_task_runs.findMany({
        where: { id: { in: blockedRunIds } },
        select: { id: true, error_message: true },
      })
    : [];
  const blockedMessageMap = new Map(blockedRuns.map((r) => [r.id, r.error_message]));

  return json({
    sessions: sessions.map((s) => ({
      id: s.id,
      searchTaskId: s.search_task_id,
      searchTaskName: searchTaskDisplayName(s.search_tasks.job_platforms?.name, s.search_tasks.note),
      status: s.status,
      goal: s.goal,
      maxIterations: s.max_iterations,
      currentIteration: s.current_iteration,
      latestStage: s.iterations[0]?.stage ?? null,
      latestSuccessPct: s.iterations[0]?.success_pct ?? null,
      latestRunId: s.iterations[0]?.run_id ?? null,
      latestRunStatus: s.iterations[0]?.run_status ?? null,
      latestGoalMet: s.iterations[0]?.goal_met ?? null,
      blockedMessage: s.iterations[0]?.run_id
        ? blockedMessageMap.get(s.iterations[0].run_id) ?? null
        : null,
      systemPrompt: s.system_prompt,
      runFirst: s.run_first,
      pendingHint: s.pending_hint,
      needsInput: s.needs_input,
      errorMessage: s.error_message,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      finishedAt: s.finished_at,
    })),
  });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);
  if (!(user as { is_admin?: boolean }).is_admin) {
    throw error(403, "Admin access required");
  }

  const body = await request.json();
  const {
    searchTaskId,
    maxIterations = 10,
    systemPrompt,
    goal,
    runFirst = false,
  } = body;

  if (!searchTaskId) {
    throw error(400, "searchTaskId is required");
  }

  if (!goal?.trim()) {
    throw error(400, "goal is required");
  }

  // Validate search task exists and is properly configured
  const searchTask = await db.search_tasks.findUnique({
    where: { id: searchTaskId },
  });

  if (!searchTask) {
    throw error(404, "Search task not found");
  }

  if (!searchTask.search_url || !searchTask.platform) {
    throw error(400, "Search task must have a URL and platform configured");
  }

  // Check no other active session for this search task
  const existing = await db.scraper_agent_sessions.findFirst({
    where: {
      search_task_id: searchTaskId,
      status: { in: ["active", "paused"] },
    },
  });

  if (existing) {
    throw error(
      409,
      `An active session (${existing.id}) already exists for this search task`,
    );
  }

  const session = await db.scraper_agent_sessions.create({
    data: {
      search_task_id: searchTaskId,
      max_iterations: Math.min(50, Math.max(1, maxIterations)),
      run_first: !!runFirst,
      goal: goal.trim(),
      system_prompt: systemPrompt || null,
    },
  });

  return json({ id: session.id, status: "active" }, { status: 201 });
};
