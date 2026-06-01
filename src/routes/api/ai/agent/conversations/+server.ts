import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { desc, eq } from "drizzle-orm";
import { agent_conversations } from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";

/** GET /api/ai/agent/conversations — the signed-in user's chat history. */
export const GET: RequestHandler = async ({ locals }) => {
  const user = requireAuth(locals);

  const conversations = await db
    .select({
      id: agent_conversations.id,
      title: agent_conversations.title,
      last_message_at: agent_conversations.last_message_at,
    })
    .from(agent_conversations)
    .where(eq(agent_conversations.user_id, user.id))
    .orderBy(desc(agent_conversations.last_message_at))
    .limit(100);

  return json({ success: true, conversations });
};
