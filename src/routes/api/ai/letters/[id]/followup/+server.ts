import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import { parseBody, followupRequestSchema } from "$lib/server/validation/api-schemas";
import { createApplicationLetterFollowup } from "$lib/server/ai-chat/application-letter-followup";

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

  const { followupRequest, includeOriginalContext } = parseBody(
    followupRequestSchema,
    await request.json(),
  );

  const result = await createApplicationLetterFollowup(
    letterId,
    followupRequest,
    includeOriginalContext,
  );

  if (!result.success) {
    return json(result, { status: 422 });
  }
  return json(result);
};
