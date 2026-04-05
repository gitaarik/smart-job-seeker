import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import { parseBody, followupRequestSchema } from "$lib/server/validation/api-schemas";
import { createFollowupAiChat } from "$lib/server/ai-chat/create-followup";
import { requireUsage, incrementUsage } from "$lib/server/billing/usage";

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  const chatId = parseIntParam(params.id, "chat");

  // Verify ownership: ai_chat -> profile -> user
  const chat = await db.ai_chats.findFirst({
    where: { id: chatId },
    include: {
      profiles: { select: { user_id: true } },
    },
  });

  if (!chat || chat.profiles.user_id !== user.id) {
    return json({ success: false, message: "Chat not found" }, { status: 404 });
  }

  const { followupRequest, includeOriginalContext } = parseBody(
    followupRequestSchema,
    await request.json(),
  );

  await requireUsage(user.id, "ai_followups");

  const result = await createFollowupAiChat(chatId, followupRequest, {
    includeOriginalContext,
  });

  if (!result.success) {
    return json(result, { status: 422 });
  }

  await incrementUsage(user.id, "ai_followups");
  return json(result);
};
