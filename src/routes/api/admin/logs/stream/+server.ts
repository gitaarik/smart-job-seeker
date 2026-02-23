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
 * - jobSearchId: Filter by job search (optional)
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

  const jobSearchIdParam = url.searchParams.get("jobSearchId");
  const jobSearchId = jobSearchIdParam ? parseInt(jobSearchIdParam) : undefined;

  // Create readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      let lastTimestamp = new Date();
      let isActive = true;

      // Send initial connection message
      controller.enqueue(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

      // Poll for new logs
      const poll = async () => {
        if (!isActive) return;

        try {
          const where: {
            job_search_id?: number | null;
            timestamp: { gt: Date };
          } = {
            timestamp: { gt: lastTimestamp },
          };

          if (jobSearchId !== undefined) {
            where.job_search_id = jobSearchId;
          }

          const newLogs = await db.scraper_logs.findMany({
            where,
            orderBy: { timestamp: "asc" },
            take: 100,
            include: {
              job_searches: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          });

          for (const log of newLogs) {
            const data = {
              type: "log",
              id: log.id,
              level: log.level,
              message: log.message,
              timestamp: log.timestamp.toISOString(),
              jobSearchId: log.job_search_id,
              jobSearchName: log.job_searches?.name,
            };
            controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
            lastTimestamp = log.timestamp;
          }

          // Send heartbeat to keep connection alive
          controller.enqueue(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`);
        } catch (err) {
          console.error("SSE poll error:", err);
        }

        // Poll every second
        if (isActive) {
          setTimeout(poll, 1000);
        }
      };

      // Start polling
      poll();

      // Handle connection close - this is called when the client disconnects
      // Note: In practice, we rely on the stream being garbage collected
      // when the connection closes. The isActive flag helps cleanup.
    },

    cancel() {
      // Stream was cancelled (client disconnected)
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
