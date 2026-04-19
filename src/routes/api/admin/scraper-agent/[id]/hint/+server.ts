import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  if (!(user as { is_admin?: boolean }).is_admin) {
    throw error(403, "Admin access required");
  }

  const sessionId = parseIntParam(params.id, "session");

  const session = await db.query.scraper_agent_sessions.findFirst({
    where: { id: sessionId },
  });

  if (!session) throw error(404, "Session not found");
  if (!["active", "paused"].includes(session.status)) {
    throw error(400, `Cannot add hint to session with status "${session.status}"`);
  }

  const body = await request.json();
  const { hint } = body;

  await db.scraper_agent_sessions.update({
    where: { id: sessionId },
    data: { pending_hint: hint || null, updated_at: new Date() },
  });

  return json({ ok: true });
};
