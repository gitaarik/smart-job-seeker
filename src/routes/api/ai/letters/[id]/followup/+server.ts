import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { application_letters } from "$lib/server/db/schema";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import { parseBody, followupRequestSchema } from "$lib/server/validation/api-schemas";
import { createApplicationLetterFollowup } from "$lib/server/ai-chat/application-letter-followup";
import { generateApplicationLetter } from "$lib/server/ai-chat/application-letter";
import { LETTER_VERSIONS, trimVersionsFrom } from "$lib/server/ai-chat/entity-versions";
import { requireCredits } from "$lib/server/billing/require-credits";

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  const letterId = parseIntParam(params.id, "letter");

  // Verify ownership: letter -> application -> profile -> user
  const letter = await db.query.application_letters.findFirst({
    where: eq(application_letters.id, letterId),
    with: {
      application: {
        with: { profile: { columns: { user_id: true } } },
      },
    },
  });

  if (!letter || letter.application.profile.user_id !== user.id) {
    return json({ success: false, message: "Letter not found" }, { status: 404 });
  }

  const { followupRequest, includeOriginalContext, updateContent, mode, replaceVersionId } = parseBody(
    followupRequestSchema,
    await request.json(),
  );

  // If replacing a version, delete it and all subsequent versions first, then
  // restore the ai_chat pointer to the last remaining version — via the engine.
  //
  // Editing the message of the turn that STARTED the thread is a special case:
  // the trim takes that turn's ai_chat with it, so there is nothing left to
  // follow up on. Restart the same kind of turn instead, with the edited
  // message as its brief, rather than failing with "does not have an ai_chats
  // yet". Only generate/advice can start a thread with a message attached.
  let restartMode: "generate" | "advice" | null = null;
  if (replaceVersionId) {
    const { existed, removedSource, last } = await trimVersionsFrom(LETTER_VERSIONS, letterId, replaceVersionId);
    if (!existed) {
      return json({ success: false, message: "Version not found" }, { status: 404 });
    }
    await db.update(application_letters).set({
      ai_chat_id: last?.ai_chat ?? null,
    }).where(eq(application_letters.id, letterId));
    if (!last?.ai_chat) {
      restartMode = removedSource === "ai_advice" ? "advice" : "generate";
    }
  }

  await requireCredits(user.id, 5);

  const result = restartMode
    ? await generateApplicationLetter(letterId, followupRequest, restartMode)
    : await createApplicationLetterFollowup(
      letterId,
      followupRequest,
      includeOriginalContext,
      updateContent,
      mode,
    );

  if (!result.success) {
    return json(result, { status: 422 });
  }

  return json(result);
};
