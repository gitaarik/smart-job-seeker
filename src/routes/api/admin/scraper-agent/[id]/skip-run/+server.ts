import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";

export const POST: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  if (!(user as { is_admin?: boolean }).is_admin) {
    throw error(403, "Admin access required");
  }

  const sessionId = parseIntParam(params.id, "session");

  const session = await db.query.scraper_agent_sessions.findFirst({
    where: { id: sessionId },
  });

  if (!session) throw error(404, "Session not found");
  if (session.status !== "active") {
    throw error(400, `Cannot skip run for session with status "${session.status}"`);
  }

  // Find the latest iteration's run
  const latestIteration = await db.query.scraper_agent_iterations.findFirst({
    where: { session_id: sessionId },
    orderBy: { iteration: "desc" },
  });

  if (!latestIteration?.run_id) {
    throw error(400, "No active run to skip");
  }

  // Check the run is actually blocked/running
  const run = await db.query.search_task_runs.findFirst({
    where: { id: latestIteration.run_id },
    select: { status: true },
  });

  if (!run || !["running", "queued", "blocked", "stopping"].includes(run.status)) {
    throw error(400, `Run is not active (status: ${run?.status || "not found"})`);
  }

  // Force the run to "partial" so the agent sees it as finished and evaluates
  await db.search_task_runs.update({
    where: { id: latestIteration.run_id },
    data: {
      status: "partial",
      error_message: "Skipped by user (manual intervention bypassed)",
      finished_at: new Date(),
    },
  });

  return json({ ok: true });
};
