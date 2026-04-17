import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import { parseBody, followupRequestSchema } from "$lib/server/validation/api-schemas";
import { createApplicationLetterFollowup } from "$lib/server/ai-chat/application-letter-followup";
import { requireCredits } from "$lib/server/billing/credits";

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  const letterId = parseIntParam(params.id, "letter");

  // Verify ownership: letter -> application -> profile -> user
  const letter = await db.application_letters.findFirst({
    where: { id: letterId },
    include: {
      applications: {
        include: { profiles: { select: { user_id: true } } },
      },
    },
  });

  if (!letter || letter.applications.profiles.user_id !== user.id) {
    return json({ success: false, message: "Letter not found" }, { status: 404 });
  }

  const { followupRequest, includeOriginalContext, updateContent, mode, replaceVersionId } = parseBody(
    followupRequestSchema,
    await request.json(),
  );

  // If replacing a version, delete it and all subsequent versions first
  if (replaceVersionId) {
    // Verify the version belongs to this letter
    const version = await db.letter_versions.findFirst({
      where: { id: replaceVersionId, letter: letterId },
    });
    if (!version) {
      return json({ success: false, message: "Version not found" }, { status: 404 });
    }
    // Delete this version and all versions after it
    await db.letter_versions.deleteMany({
      where: { letter: letterId, id: { gte: replaceVersionId } },
    });

    // Restore ai_chat pointer to the previous version's ai_chat (or the last remaining version's)
    const lastVersion = await db.letter_versions.findFirst({
      where: { letter: letterId },
      orderBy: { id: "desc" },
      select: { ai_chat: true, content: true },
    });
    await db.application_letters.update({
      where: { id: letterId },
      data: {
        ai_chat_id: lastVersion?.ai_chat ?? null,
      },
    });
  }

  await requireCredits(user.id, 5);

  const result = await createApplicationLetterFollowup(
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
