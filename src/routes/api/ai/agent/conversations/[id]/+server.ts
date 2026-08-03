import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, asc, eq } from "drizzle-orm";
import { agent_conversations, agent_messages } from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";
import {
  type Capability,
  CAPABILITIES,
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
      proposal: agent_messages.proposal,
      applied_at: agent_messages.proposal_applied_at,
    })
    .from(agent_messages)
    .where(eq(agent_messages.conversation_id, id))
    .orderBy(asc(agent_messages.id));

  // Rebuild each card's diff against the row's *current* values, not the ones
  // captured when it was proposed. A thread resumes up to 12h later, by which
  // time the user may well have made the change by hand — showing the stale
  // "from" would invite them to re-apply an edit that is already in place.
  const messages = await Promise.all(rows.map(async (m) => {
    if (!m.proposal) {
      return { id: m.id, role: m.role, content: m.content, proposal: null };
    }
    const capability = m.proposal.capability as Capability;
    const def = CAPABILITIES[capability];
    const current = def && !m.applied_at
      ? await def.current(m.proposal.target).catch(() => ({}))
      : {};
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      proposal: {
        message_id: m.id,
        capability,
        title: def?.title ?? capability,
        rationale: m.proposal.rationale,
        target: m.proposal.target,
        changes: def
          ? describeProposalChanges(capability, m.proposal.fields, current)
          : [],
        applied_at: m.applied_at?.toISOString() ?? null,
      },
    };
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
