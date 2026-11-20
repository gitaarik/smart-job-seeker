import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '#lib/server/db/index.ts';
import { eq } from 'drizzle-orm';
import { ai_chats } from '#lib/server/db/schema.ts';
import { requireAuth, parseIntParam } from '#lib/server/utils/api-helpers.ts';
import { parseBody, followupRequestSchema } from '#lib/server/validation/api-schemas.ts';
import { createFollowupAiChat } from '#lib/server/ai-chat/create-followup.ts';
import { requireCredits } from '#lib/server/billing/require-credits.ts';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const chatId = parseIntParam(params.id, 'chat');

	// Verify ownership: ai_chat -> profile -> user
	const chat = await db.query.ai_chats.findFirst({
		where: eq(ai_chats.id, chatId),
		with: {
			profile: { columns: { user_id: true } }
		}
	});

	if (!chat || chat.profile.user_id !== user.id) {
		return json({ success: false, message: 'Chat not found' }, { status: 404 });
	}

	const { followupRequest, includeOriginalContext } = parseBody(
		followupRequestSchema,
		await request.json()
	);

	await requireCredits(user.id, 5);

	const result = await createFollowupAiChat(chatId, followupRequest, {
		includeOriginalContext
	});

	if (!result.success) {
		return json(result, { status: 422 });
	}

	return json(result);
};
