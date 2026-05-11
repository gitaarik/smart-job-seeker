/**
 * POST /api/admin/discover/[id]/cancel
 *
 * Cancels a queued or running discovery run.
 *  - queued: remove the BullMQ job from the queue and mark the row
 *    cancelled directly.
 *  - running: flip status to "cancelling"; the worker polls for this
 *    state (parallel to the scraper's stopping flow) and aborts the
 *    in-flight job via worker.cancelJob().
 */
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { platform_discovery_runs } from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";
import { getDiscoveryQueue } from "$lib/server/queue/discovery-queue";

function requireAdmin(locals: App.Locals) {
  const user = requireAuth(locals);
  if (!(user as { is_admin?: boolean }).is_admin) {
    throw error(403, "Admin access required");
  }
  return user;
}

export const POST: RequestHandler = async ({ locals, params }) => {
  requireAdmin(locals);
  const id = parseInt(params.id ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) throw error(400, "Invalid run id");

  const run = await db.query.platform_discovery_runs.findFirst({
    where: eq(platform_discovery_runs.id, id),
  });
  if (!run) throw error(404, "Run not found");
  if (["success", "error", "cancelled"].includes(run.status)) {
    return json({ ok: true, alreadyTerminal: true });
  }

  // Queued: remove from BullMQ + mark cancelled.
  if (run.status === "queued") {
    if (run.bullmq_job_id) {
      try {
        const queue = getDiscoveryQueue();
        const job = await queue.getJob(run.bullmq_job_id);
        if (job) await job.remove();
      } catch (e) {
        console.warn(
          "[discover/cancel] queue remove failed (job may have started):",
          e,
        );
      }
    }
    await db.update(platform_discovery_runs).set({
      status: "cancelled",
      finished_at: new Date(),
      error_message: "Cancelled by admin",
    }).where(eq(platform_discovery_runs.id, id));
    return json({ ok: true, mode: "queued" });
  }

  // Running: flip to cancelling and let the worker's poller detect it
  // and abort the live BullMQ job.
  await db.update(platform_discovery_runs).set({
    status: "cancelling",
  }).where(eq(platform_discovery_runs.id, id));
  return json({ ok: true, mode: "running" });
};
