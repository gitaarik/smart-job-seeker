import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { application_letters } from "$lib/server/db/schema";
import { parseIntParam, requireAuth } from "$lib/server/utils/api-helpers";
import {
  letterGenerateSchema,
  parseBody,
} from "$lib/server/validation/api-schemas";
import { generateApplicationLetter } from "$lib/server/ai-chat/application-letter";
import { trackGeneration } from "$lib/server/ai-chat/ai-generation-status";
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
    return json({ success: false, message: "Letter not found" }, {
      status: 404,
    });
  }

  await requireCredits(user.id, 5);

  const body = await request.json().catch(() => ({}));
  const { instructions, mode } = parseBody(letterGenerateSchema, body);

  const result = await trackGeneration(
    "letter",
    letterId,
    mode,
    () => generateApplicationLetter(letterId, instructions, mode),
  );

  if (!result.success) {
    return json(result, { status: 422 });
  }

  return json(result);
};
