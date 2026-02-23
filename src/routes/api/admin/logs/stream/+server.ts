import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";

/**
 * GET /api/admin/logs/stream
 *
 * Server-Sent Events endpoint for real-time log streaming.
 * Admin only. Polls database every second for new logs.
 *
 * Query params:
 * - runId: Filter by run ID (optional)
 * - jobSearchId: Filter by job search ID (optional) - shows logs from all runs of that search
 */
export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  // Check admin status
  const dbUser = await db.users.findUnique({
    where: { id: user.id },
    select: { is_admin: true },
  });

  if (!dbUser?.is_admin) {
    throw error(403, "Admin access required");
  }

  const runIdParam = url.searchParams.get("runId");
  const runId = runIdParam ? parseInt(runIdParam) : undefined;

  const jobSearchIdParam = url.searchParams.get("jobSearchId");
  const jobSearchId = jobSearchIdParam ? parseInt(jobSearchIdParam) : undefined;

  // Track if stream is still active (shared between start and cancel)
  let isActive = true;

  // Create readable stream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastTimestamp = new Date();

      // Send initial connection message
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`));
      } catch {
        isActive = false;
        return;
      }

      // Poll for new logs
      const poll = async () => {
        if (!isActive) return;

        try {
          // Build where clause based on filters
          interface WhereClause {
            timestamp: { gt: Date };
            run_id?: number;
            run?: { job_search_id: number };
          }

          const where: WhereClause = {
            timestamp: { gt: lastTimestamp },
          };

          if (runId !== undefined) {
            where.run_id = runId;
          } else if (jobSearchId !== undefined) {
            where.run = { job_search_id: jobSearchId };
          }

          const newLogs = await db.scraper_logs.findMany({
            where,
            orderBy: { timestamp: "asc" },
            take: 100,
            include: {
              run: {
                select: {
                  id: true,
                  job_search_id: true,
                  status: true,
                  job_searches: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          });

          for (const log of newLogs) {
            if (!isActive) return;
            const data = {
              type: "log",
              id: log.id,
              level: log.level,
              message: log.message,
              timestamp: log.timestamp.toISOString(),
              runId: log.run_id,
              runStatus: log.run?.status,
              jobSearchId: log.run?.job_search_id,
              jobSearchName: log.run?.job_searches?.name,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            lastTimestamp = log.timestamp;
          }

          // Send heartbeat to keep connection alive
          if (isActive) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`));
          }
        } catch (err) {
          // Check if it's a controller closed error (expected when client disconnects)
          if (err instanceof TypeError && String(err).includes("Controller is already closed")) {
            isActive = false;
            return;
          }
          console.error("SSE poll error:", err);
        }

        // Poll every second
        if (isActive) {
          setTimeout(poll, 1000);
        }
      };

      // Start polling
      poll();
    },

    cancel() {
      // Stream was cancelled (client disconnected)
      isActive = false;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
