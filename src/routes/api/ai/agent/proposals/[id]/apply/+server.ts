import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, eq } from "drizzle-orm";
import {
  agent_conversations,
  agent_message_proposals,
  agent_messages,
} from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";
import {
  CAPABILITIES,
  type Capability,
  pickCapabilityFields,
} from "$lib/server/ai-chat/capabilities";

/**
 * POST /api/ai/agent/proposals/:id/apply — commit an edit the assistant
 * proposed, where `:id` is an `agent_message_proposals` row.
 *
 * Keyed on the proposal, not the turn that produced it: one message can propose
 * several, each its own card, and accepting the salary fix must not mark the
 * description rewrite accepted too.
 *
 * One endpoint for every capability, rather than routing each through the page
 * action that would otherwise do the write. Three reasons that isn't laziness:
 *
 *  - the two pages that have a details form both call the action
 *    `?/updateDetails`, over different field sets;
 *  - "edit the job attached to this application" has no page action at all;
 *  - the chat is global, and a proposal made on one page can be applied after
 *    the user has navigated somewhere else.
 *
 * So the capability owns the write, and the page form and this endpoint meet
 * further down — in applyJobFields — rather than one calling the other.
 *
 * Everything is re-derived here. The stored payload came from a model, and the
 * proposal id came from the client; the only things trusted are the session and
 * the database.
 */
export const POST: RequestHandler = async ({ locals, params }) => {
  const user = requireAuth(locals);

  const proposalId = parseInt(params.id ?? "", 10);
  if (Number.isNaN(proposalId)) {
    return json({ success: false, message: "Invalid proposal id." }, {
      status: 400,
    });
  }

  // Join out to the conversation: that is what ties this proposal to a user.
  const [row] = await db
    .select({
      id: agent_message_proposals.id,
      profile_id: agent_messages.profile_id,
      capability: agent_message_proposals.capability,
      fields: agent_message_proposals.fields,
      target: agent_message_proposals.target,
      applied_at: agent_message_proposals.applied_at,
    })
    .from(agent_message_proposals)
    .innerJoin(
      agent_messages,
      eq(agent_message_proposals.message_id, agent_messages.id),
    )
    .innerJoin(
      agent_conversations,
      eq(agent_messages.conversation_id, agent_conversations.id),
    )
    .where(
      and(
        eq(agent_message_proposals.id, proposalId),
        eq(agent_conversations.user_id, user.id),
      ),
    )
    .limit(1);

  if (!row) {
    return json({ success: false, message: "Proposal not found." }, {
      status: 404,
    });
  }

  if (row.applied_at) {
    return json(
      { success: false, message: "This change was already applied." },
      { status: 409 },
    );
  }

  const stored = row;
  const capability = stored.capability as Capability;
  const def = CAPABILITIES[capability];
  if (!def) {
    return json({ success: false, message: "Unknown change type." }, {
      status: 400,
    });
  }

  const profileId = row.profile_id;
  if (!profileId) {
    return json({ success: false, message: "Proposal has no profile." }, {
      status: 400,
    });
  }

  const isStaff = !!(user as { is_staff?: boolean }).is_staff ||
    !!(user as { is_admin?: boolean }).is_admin;
  const actor = { profileId, isStaff };

  // Re-authorize against the row as it is *now*, not as it was when proposed.
  // Rights can have been lost in between — a job un-imported, an application
  // moved — and a proposal sitting in a 12h-resumable thread is exactly the
  // window in which that happens.
  const target = { id: stored.target.id, label: stored.target.label };
  if (!await def.authorize(target, actor)) {
    return json(
      { success: false, message: "You can no longer make this change." },
      { status: 403 },
    );
  }

  // Re-read current values and re-validate. The row may have moved since the
  // proposal was made, and a partial edit is merged over whatever is there now
  // — applying stale values around the changed field would quietly revert
  // whatever else happened in between.
  const current = await def.current(target);
  const fields = pickCapabilityFields(capability, stored.fields ?? {});
  if (Object.keys(fields).length === 0) {
    return json({ success: false, message: "Nothing to change." }, {
      status: 400,
    });
  }

  const valid = def.validate(fields, current);
  if (!valid.ok) {
    return json({ success: false, message: valid.error }, { status: 400 });
  }

  await def.apply(target, fields, current);

  await db
    .update(agent_message_proposals)
    .set({ applied_at: new Date() })
    .where(eq(agent_message_proposals.id, proposalId));

  return json({ success: true });
};
