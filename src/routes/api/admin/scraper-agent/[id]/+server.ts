/**
 * Admin Scraper Agent Session Detail API
 *
 * GET - Get session details with all iterations
 */

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";

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
          name: true,
          search_url: true,
          platform: true,
          browser_provider: true,
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

  return json({
    session: {
      id: session.id,
      searchTaskId: session.search_task_id,
      searchTaskName: session.search_tasks.name,
      status: session.status,
      goal: session.goal,
      maxIterations: session.max_iterations,
      currentIteration: session.current_iteration,
      claudeSessionId: session.claude_session_id,
      systemPrompt: session.system_prompt,
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
