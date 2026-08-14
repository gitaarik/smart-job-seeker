import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, asc, eq, inArray } from 'drizzle-orm';
import {
	agent_conversations,
	agent_message_proposals,
	agent_messages
} from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import {
	CAPABILITIES,
	type Capability,
	describeProposalChanges
} from '$lib/server/ai-chat/capabilities';
import { requireConversationProfile } from '../../scope';
import { summarizeProposal } from '$lib/server/ai-chat/proposal-summary';

/**
 * GET /api/ai/agent/conversations/:id — full transcript for resuming a thread.
 *
 * Scoped to the profile as well as the user (see ../scope.ts). That is what
 * makes the client's stored pointer self-healing across a profile switch: the
 * thread 404s, and the 404 path already drops the pointer and starts fresh.
 */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	const user = requireAuth(locals);
	const profileId = await requireConversationProfile(url, user.id);
	const id = parseInt(params.id ?? '', 10);
	if (Number.isNaN(id)) {
		return json(
			{ success: false, message: 'Invalid conversation id.' },
			{
				status: 400
			}
		);
	}

	const [conversation] = await db
		.select({ id: agent_conversations.id, title: agent_conversations.title })
		.from(agent_conversations)
		.where(
			and(
				eq(agent_conversations.id, id),
				eq(agent_conversations.user_id, user.id),
				eq(agent_conversations.profile_id, profileId)
			)
		)
		.limit(1);

	if (!conversation) {
		return json(
			{ success: false, message: 'Conversation not found.' },
			{
				status: 404
			}
		);
	}

	const rows = await db
		.select({
			id: agent_messages.id,
			role: agent_messages.role,
			content: agent_messages.content
		})
		.from(agent_messages)
		.where(eq(agent_messages.conversation_id, id))
		.orderBy(asc(agent_messages.id));

	// Every proposal in the thread in one query, then grouped — rather than one
	// query per message, which on a long thread is most of the transcript.
	const proposalRows =
		rows.length > 0
			? await db
					.select()
					.from(agent_message_proposals)
					.where(
						inArray(
							agent_message_proposals.message_id,
							rows.map((m) => m.id)
						)
					)
					.orderBy(asc(agent_message_proposals.id))
			: [];

	const byMessage = new Map<number, typeof proposalRows>();
	for (const p of proposalRows) {
		const list = byMessage.get(p.message_id) ?? [];
		list.push(p);
		byMessage.set(p.message_id, list);
	}

	// A PENDING proposal is rebuilt against the row's *current* values, not the
	// ones captured when it was proposed: a thread resumes up to 12h later, by
	// which time the user may well have made the change by hand, and showing the
	// stale "from" would invite them to re-apply an edit already in place.
	//
	// An APPLIED one is the opposite — its "from" is history and re-reading would
	// return the value it wrote. That case used to fall through to `{}`, so every
	// applied field rendered as "— → value" and claimed to have been empty
	// beforehand; a salary corrected from 75000 to 55000 read back as
	// "— → 55,000". It now uses the before-image stored at apply time. Rows from
	// before that column keep the old behaviour rather than inventing a history.
	// The same actor shape the apply route builds, because `current` reads the
	// row against it — a transcript must not render a profile row to whoever
	// asks for the conversation.
	const actor = {
		profileId,
		isStaff:
			!!(user as { is_staff?: boolean }).is_staff || !!(user as { is_admin?: boolean }).is_admin
	};

	const messages = await Promise.all(
		rows.map(async (m) => {
			const mine = byMessage.get(m.id) ?? [];
			const proposals = await Promise.all(
				mine.map(async (p) => {
					const capability = p.capability as Capability;
					const def = CAPABILITIES[capability];
					const current = !def
						? {}
						: p.applied_at
							? (p.previous ?? {})
							: await def.current(p.target, actor).catch(() => ({}));
					const changes = def ? describeProposalChanges(capability, p.fields, current) : [];
					return {
						id: p.id,
						capability,
						title: def?.title ?? capability,
						rationale: p.rationale,
						target: p.target,
						changes,
						// The same edit as prose, for anything that isn't the card — see
						// proposal-summary.ts.
						summary: def
							? summarizeProposal({
									title: def.title,
									target: p.target,
									changes,
									rationale: p.rationale,
									applied: !!p.applied_at
								})
							: '',
						applied_at: p.applied_at?.toISOString() ?? null
					};
				})
			);
			return { id: m.id, role: m.role, content: m.content, proposals };
		})
	);

	return json({ success: true, conversation, messages });
};

/**
 * DELETE /api/ai/agent/conversations/:id — remove a thread (messages cascade).
 *
 * User-scoped only, deliberately unlike the GET above. Scoping a read stops the
 * user being shown a thread they cannot resume; scoping a delete would only
 * stop them discarding their own, and a thread that has become invisible in
 * every list is the one case where they most plainly should be able to.
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals);
	const id = parseInt(params.id ?? '', 10);
	if (Number.isNaN(id)) {
		return json(
			{ success: false, message: 'Invalid conversation id.' },
			{
				status: 400
			}
		);
	}

	const deleted = await db
		.delete(agent_conversations)
		.where(and(eq(agent_conversations.id, id), eq(agent_conversations.user_id, user.id)))
		.returning({ id: agent_conversations.id });

	if (deleted.length === 0) {
		return json(
			{ success: false, message: 'Conversation not found.' },
			{
				status: 404
			}
		);
	}

	return json({ success: true });
};
