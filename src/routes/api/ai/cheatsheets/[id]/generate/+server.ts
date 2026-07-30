import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { cheat_sheets, profiles } from "$lib/server/db/schema";
import { parseIntParam, requireAuth } from "$lib/server/utils/api-helpers";
import {
  cheatSheetGenerateSchema,
  parseBody,
} from "$lib/server/validation/api-schemas";
import { generateProfileCheatSheet } from "$lib/server/ai-chat/profile-cheatsheet";
import { trackGeneration } from "$lib/server/ai-chat/ai-generation-status";
import { requireCredits } from "$lib/server/billing/require-credits";

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  const cheatSheetId = parseIntParam(params.id, "cheat sheet");

  // Verify ownership: cheat sheet -> profile -> user.
  const sheet = await db.query.cheat_sheets.findFirst({
    where: eq(cheat_sheets.id, cheatSheetId),
    columns: { id: true, profile_id: true },
  });
  const profile = sheet
    ? await db.query.profiles.findFirst({
      where: eq(profiles.id, sheet.profile_id),
      columns: { user_id: true },
    })
    : null;
  if (!sheet || profile?.user_id !== user.id) {
    return json({ success: false, message: "Cheat sheet not found" }, {
      status: 404,
    });
  }

  const { mode, instructions } = parseBody(
    cheatSheetGenerateSchema,
    await request.json().catch(() => ({})),
  );

  await requireCredits(user.id, 5);

  const result = await trackGeneration(
    "cheatsheet",
    cheatSheetId,
    mode,
    () => generateProfileCheatSheet(cheatSheetId, { mode, instructions }),
  );
  if (!result.success) return json(result, { status: 422 });
  return json(result);
};
