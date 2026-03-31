import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import { parseBody, letterGenerateSchema } from "$lib/server/validation/api-schemas";
import { generateApplicationLetter } from "$lib/server/ai-chat/application-letter";

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

  const body = await request.json().catch(() => ({}));
  const { additionalContext, mode } = parseBody(letterGenerateSchema, body);

  const result = await generateApplicationLetter(letterId, additionalContext, mode);

  if (!result.success) {
    return json(result, { status: 422 });
  }
  return json(result);
};
