import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, asc, eq } from "drizzle-orm";
import { agent_conversations, agent_messages } from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";

/** GET /api/ai/agent/conversations/:id — full transcript for resuming a thread. */
export const GET: RequestHandler = async ({ locals, params }) => {
  const user = requireAuth(locals);
  const id = parseInt(params.id ?? "", 10);
  if (Number.isNaN(id)) {
    return json({ success: false, message: "Invalid conversation id." }, {
      status: 400,
    });
  }

  const [conversation] = await db
    .select({ id: agent_conversations.id, title: agent_conversations.title })
    .from(agent_conversations)
    .where(
      and(
        eq(agent_conversations.id, id),
        eq(agent_conversations.user_id, user.id),
      ),
    )
    .limit(1);

  if (!conversation) {
    return json({ success: false, message: "Conversation not found." }, {
      status: 404,
    });
  }

  const messages = await db
    .select({ role: agent_messages.role, content: agent_messages.content })
    .from(agent_messages)
    .where(eq(agent_messages.conversation_id, id))
    .orderBy(asc(agent_messages.id));

  return json({ success: true, conversation, messages });
};

/** DELETE /api/ai/agent/conversations/:id — remove a thread (messages cascade). */
export const DELETE: RequestHandler = async ({ locals, params }) => {
  const user = requireAuth(locals);
  const id = parseInt(params.id ?? "", 10);
  if (Number.isNaN(id)) {
    return json({ success: false, message: "Invalid conversation id." }, {
      status: 400,
    });
  }

  const deleted = await db
    .delete(agent_conversations)
    .where(
      and(
        eq(agent_conversations.id, id),
        eq(agent_conversations.user_id, user.id),
      ),
    )
    .returning({ id: agent_conversations.id });

  if (deleted.length === 0) {
    return json({ success: false, message: "Conversation not found." }, {
      status: 404,
    });
  }

  return json({ success: true });
};
