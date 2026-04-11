/**
 * Admin Scraper Agent Session Detail API
 *
 * GET - Get session details with all iterations
 * PATCH - Update session settings (e.g. maxIterations)
 */

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import { searchTaskDisplayName } from "$lib/format";

export const GET: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  if (!(user as { is_admin?: boolean }).is_admin) {
    throw error(403, "Admin access required");
  }

  const sessionId = parseIntParam(params.id, "session");

  const session = await db.scraper_agent_sessions.findUnique({
    where: { id: sessionId },
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
        orderBy: { iteration: "asc" },
        select: {
          id: true,
          iteration: true,
          stage: true,
          run_id: true,
          run_status: true,
          items_total: true,
          items_completed: true,
          items_error: true,
          success_pct: true,
          goal_met: true,
          goal_evaluation: true,
          prompt: true,
          claude_analysis: true,
          claude_changes: true,
          started_at: true,
          finished_at: true,
        },
      },
    },
  });

  if (!session) {
    throw error(404, "Session not found");
  }

  // Check if the latest iteration's run is blocked
  const latestIter = session.iterations[session.iterations.length - 1];
  let blockedMessage: string | null = null;
  if (latestIter?.stage === "blocked" && latestIter.run_id) {
    const run = await db.search_task_runs.findUnique({
      where: { id: latestIter.run_id },
      select: { error_message: true },
    });
    blockedMessage = run?.error_message ?? null;
  }

  return json({
    session: {
      id: session.id,
      searchTaskId: session.search_task_id,
      searchTaskName: searchTaskDisplayName(session.search_tasks.job_platforms?.name, session.search_tasks.note),
      status: session.status,
      goal: session.goal,
      maxIterations: session.max_iterations,
      currentIteration: session.current_iteration,
      runFirst: session.run_first,
      pendingHint: session.pending_hint,
      needsInput: session.needs_input,
      blockedMessage,
      systemPrompt: session.system_prompt,
      claudeSessionId: session.claude_session_id,
      errorMessage: session.error_message,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      finishedAt: session.finished_at,
    },
    iterations: session.iterations.map((i) => ({
      id: i.id,
      iteration: i.iteration,
      stage: i.stage,
      runId: i.run_id,
      runStatus: i.run_status,
      itemsTotal: i.items_total,
      itemsCompleted: i.items_completed,
      itemsError: i.items_error,
      successPct: i.success_pct,
      goalMet: i.goal_met,
      goalEvaluation: i.goal_evaluation,
      prompt: i.prompt,
      claudeAnalysis: i.claude_analysis,
      claudeChanges: i.claude_changes,
      startedAt: i.started_at,
      finishedAt: i.finished_at,
    })),
  });
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  if (!(user as { is_admin?: boolean }).is_admin) {
    throw error(403, "Admin access required");
  }

  const sessionId = parseIntParam(params.id, "session");

  const session = await db.scraper_agent_sessions.findUnique({
    where: { id: sessionId },
  });

  if (!session) throw error(404, "Session not found");
  if (!["active", "paused"].includes(session.status)) {
    throw error(400, `Cannot update session with status "${session.status}"`);
  }

  const body = await request.json();
  const data: Record<string, unknown> = { updated_at: new Date() };

  if (body.maxIterations !== undefined) {
    const val = Math.min(50, Math.max(session.current_iteration + 1, Math.round(body.maxIterations)));
    data.max_iterations = val;
  }

  await db.scraper_agent_sessions.update({
    where: { id: sessionId },
    data,
  });

  return json({ ok: true });
};
