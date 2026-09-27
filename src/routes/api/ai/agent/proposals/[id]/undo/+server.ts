import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, desc, eq } from 'drizzle-orm';
import {
	agent_conversations,
	agent_message_proposals,
	agent_messages,
	capability_edits
} from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { revertEdit } from '$lib/server/ai-chat/edit-log';

/**
 * POST /api/ai/agent/proposals/:id/undo — take back an applied proposal from
 * the chat, where `:id` is an `agent_message_proposals` row.
 *
 * The receipt's Undo, for an entry the gate logged without a click
 * (ai-chat/direct-log.ts). Keyed on the proposal like its apply twin, because
 * that is the id the card holds. The change itself belongs to the edit log, and
 * the undo is `revertEdit`, the one the changes feed calls, so it refuses what
 * the feed refuses: an entry edited or given a file since, and anything a newer
 * change to the same row would be overwritten by.
 */
export const POST: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals);
	const proposalId = parseInt(params.id ?? '', 10);
	if (Number.isNaN(proposalId)) {
		return json({ success: false, message: 'Invalid proposal id.' }, { status: 400 });
	}

	// Joined out to the conversation, which is what ties a proposal to a user.
	const [row] = await db
		.select({
			profile_id: agent_messages.profile_id,
			applied_at: agent_message_proposals.applied_at
		})
		.from(agent_message_proposals)
		.innerJoin(agent_messages, eq(agent_message_proposals.message_id, agent_messages.id))
		.innerJoin(agent_conversations, eq(agent_messages.conversation_id, agent_conversations.id))
		.where(
			and(eq(agent_message_proposals.id, proposalId), eq(agent_conversations.user_id, user.id))
		)
		.limit(1);

	if (!row?.profile_id) {
		return json({ success: false, message: 'Proposal not found.' }, { status: 404 });
	}
	if (!row.applied_at) {
		return json({ success: false, message: 'This change was never applied.' }, { status: 409 });
	}

	const [edit] = await db
		.select({ id: capability_edits.id })
		.from(capability_edits)
		.where(
			and(
				eq(capability_edits.proposal_id, proposalId),
				eq(capability_edits.profile_id, row.profile_id)
			)
		)
		.orderBy(desc(capability_edits.id))
		.limit(1);
	if (!edit) {
		return json(
			{ success: false, message: 'There is no record of this change to undo.' },
			{ status: 409 }
		);
	}

	const isStaff =
		!!(user as { is_staff?: boolean }).is_staff || !!(user as { is_admin?: boolean }).is_admin;
	const outcome = await revertEdit(edit.id, { profileId: row.profile_id, isStaff });
	if (!outcome.ok) {
		return json(
			{ success: false, message: outcome.error, reason: outcome.reason },
			{ status: outcome.reason === 'not_found' ? 404 : 409 }
		);
	}

	return json({ success: true, undone_at: new Date().toISOString() });
};
