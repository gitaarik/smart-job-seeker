import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import {
	agent_conversations,
	agent_message_proposals,
	agent_messages
} from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import {
	CAPABILITIES,
	type Capability,
	type CapabilityRefusal,
	executeCapability
} from '$lib/server/ai-chat/capabilities';

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
 * What this route owns is the *proposal*: finding it, proving it belongs to the
 * caller, and marking it applied exactly once. The write itself is
 * `executeCapability`, which re-authorizes, re-reads and re-validates on the way
 * through — deliberately not this route's code, so the same guarantees hold for
 * a caller that never had a proposal at all.
 */
export const POST: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals);

	const proposalId = parseInt(params.id ?? '', 10);
	if (Number.isNaN(proposalId)) {
		return json(
			{ success: false, message: 'Invalid proposal id.' },
			{
				status: 400
			}
		);
	}

	// Join out to the conversation: that is what ties this proposal to a user.
	const [row] = await db
		.select({
			id: agent_message_proposals.id,
			profile_id: agent_messages.profile_id,
			capability: agent_message_proposals.capability,
			fields: agent_message_proposals.fields,
			target: agent_message_proposals.target,
			applied_at: agent_message_proposals.applied_at
		})
		.from(agent_message_proposals)
		.innerJoin(agent_messages, eq(agent_message_proposals.message_id, agent_messages.id))
		.innerJoin(agent_conversations, eq(agent_messages.conversation_id, agent_conversations.id))
		.where(
			and(eq(agent_message_proposals.id, proposalId), eq(agent_conversations.user_id, user.id))
		)
		.limit(1);

	if (!row) {
		return json(
			{ success: false, message: 'Proposal not found.' },
			{
				status: 404
			}
		);
	}

	if (row.applied_at) {
		return json({ success: false, message: 'This change was already applied.' }, { status: 409 });
	}

	const stored = row;
	const capability = stored.capability as Capability;
	const def = CAPABILITIES[capability];
	if (!def) {
		return json(
			{ success: false, message: 'Unknown change type.' },
			{
				status: 400
			}
		);
	}

	const profileId = row.profile_id;
	if (!profileId) {
		return json(
			{ success: false, message: 'Proposal has no profile.' },
			{
				status: 400
			}
		);
	}

	const isStaff =
		!!(user as { is_staff?: boolean }).is_staff || !!(user as { is_admin?: boolean }).is_admin;
	const actor = { profileId, isStaff };

	const target = { id: stored.target.id, label: stored.target.label };
	const outcome = await executeCapability(capability, target, actor, stored.fields ?? {});

	if (!outcome.ok) {
		const status: Record<CapabilityRefusal, number> = {
			// Rights lost since the proposal was made — a job un-imported, an
			// application moved. A 12h-resumable thread is exactly the window in
			// which that happens.
			unauthorized: 403,
			empty: 400,
			invalid: 400
		};
		return json(
			{ success: false, message: outcome.error },
			{
				status: status[outcome.reason]
			}
		);
	}

	// `previous` is rewritten, not left as proposed. It was captured when the
	// assistant answered; the write happened later — up to twelve hours later, in
	// a resumable thread — and what it replaced is what executeCapability read on
	// its way through. Keeping the proposal-time values would record an undo that
	// reverts to a state that never immediately preceded this edit.
	await db
		.update(agent_message_proposals)
		.set({ applied_at: new Date(), previous: outcome.previous })
		.where(eq(agent_message_proposals.id, proposalId));

	return json({ success: true });
};
