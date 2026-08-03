import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  agent_conversations,
  agent_message_proposals,
  agent_messages,
} from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";
import {
  CAPABILITIES,
  type Capability,
  describeProposalChanges,
} from "$lib/server/ai-chat/capabilities";

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

  const rows = await db
    .select({
      id: agent_messages.id,
      role: agent_messages.role,
      content: agent_messages.content,
    })
    .from(agent_messages)
    .where(eq(agent_messages.conversation_id, id))
    .orderBy(asc(agent_messages.id));

  // Every proposal in the thread in one query, then grouped — rather than one
  // query per message, which on a long thread is most of the transcript.
  const proposalRows = rows.length > 0
    ? await db
      .select()
      .from(agent_message_proposals)
      .where(
        inArray(agent_message_proposals.message_id, rows.map((m) => m.id)),
      )
      .orderBy(asc(agent_message_proposals.id))
    : [];

  const byMessage = new Map<number, typeof proposalRows>();
  for (const p of proposalRows) {
    const list = byMessage.get(p.message_id) ?? [];
    list.push(p);
    byMessage.set(p.message_id, list);
  }

  // Rebuild each card's diff against the row's *current* values, not the ones
  // captured when it was proposed. A thread resumes up to 12h later, by which
  // time the user may well have made the change by hand — showing the stale
  // "from" would invite them to re-apply an edit that is already in place.
  const messages = await Promise.all(rows.map(async (m) => {
    const mine = byMessage.get(m.id) ?? [];
    const proposals = await Promise.all(mine.map(async (p) => {
      const capability = p.capability as Capability;
      const def = CAPABILITIES[capability];
      const current = def && !p.applied_at
        ? await def.current(p.target).catch(() => ({}))
        : {};
      return {
        id: p.id,
        capability,
        title: def?.title ?? capability,
        rationale: p.rationale,
        target: p.target,
        changes: def
          ? describeProposalChanges(capability, p.fields, current)
          : [],
        applied_at: p.applied_at?.toISOString() ?? null,
      };
    }));
    return { id: m.id, role: m.role, content: m.content, proposals };
  }));

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
