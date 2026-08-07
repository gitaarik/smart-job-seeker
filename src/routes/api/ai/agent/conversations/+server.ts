import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, desc, eq } from 'drizzle-orm';
import { agent_conversations } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { requireConversationProfile } from '../scope';

/**
 * GET /api/ai/agent/conversations — the chat history for one profile.
 *
 * Profile-scoped, not merely user-scoped. A conversation is conducted *as* a
 * profile: every turn is answered from that profile's material and stamped with
 * its id, so a thread about one applicant's applications listed under another's
 * history is a thread that cannot be resumed without changing what it was
 * about. Which is exactly what used to happen — `agent_conversations` has
 * carried `profile_id` since it was created and nothing read it.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requireAuth(locals);
	const profileId = await requireConversationProfile(url, user.id);

	const conversations = await db
		.select({
			id: agent_conversations.id,
			title: agent_conversations.title,
			last_message_at: agent_conversations.last_message_at
		})
		.from(agent_conversations)
		.where(
			and(eq(agent_conversations.user_id, user.id), eq(agent_conversations.profile_id, profileId))
		)
		.orderBy(desc(agent_conversations.last_message_at))
		.limit(100);

	return json({ success: true, conversations });
};
