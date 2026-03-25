import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";

export const load: PageServerLoad = async ({ params }) => {
  const sessionId = parseInt(params.id);
  if (isNaN(sessionId)) throw error(400, "Invalid session ID");

  const session = await db.scraper_agent_sessions.findUnique({
    where: { id: sessionId },
    include: {
      search_tasks: {
        select: { id: true, name: true },
      },
    },
  });

  if (!session) throw error(404, "Session not found");

  return { sessionId: session.id };
};
