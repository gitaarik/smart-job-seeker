import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { cheat_sheets, profiles } from "$lib/server/db/schema";
import { parseIntParam, requireAuth } from "$lib/server/utils/api-helpers";
import {
  followupRequestSchema,
  parseBody,
} from "$lib/server/validation/api-schemas";
import { createProfileCheatSheetFollowup } from "$lib/server/ai-chat/profile-cheatsheet-followup";
import { generateProfileCheatSheet } from "$lib/server/ai-chat/profile-cheatsheet";
import {
  CHEATSHEET_VERSIONS,
  trimVersionsFrom,
} from "$lib/server/ai-chat/entity-versions";
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

  const {
    followupRequest,
    includeOriginalContext,
    updateContent,
    mode,
    replaceVersionId,
  } = parseBody(followupRequestSchema, await request.json());

  // Editing a version's message: drop it and everything after, then restore the
  // ai_chat pointer to the last remaining version. If the trim removed the turn
  // that STARTED the thread, there's nothing left to follow up on — restart the
  // same kind of turn with the edited message as its brief instead.
  let restartMode: "generate" | "advice" | null = null;
  if (replaceVersionId) {
    const { existed, removedSource, last } = await trimVersionsFrom(
      CHEATSHEET_VERSIONS,
      cheatSheetId,
      replaceVersionId,
    );
    if (!existed) {
      return json({ success: false, message: "Version not found" }, {
        status: 404,
      });
    }
    await db.update(cheat_sheets).set({
      ai_chat_id: last?.ai_chat ?? null,
    }).where(eq(cheat_sheets.id, cheatSheetId));
    if (!last?.ai_chat) {
      restartMode = removedSource === "ai_advice" ? "advice" : "generate";
    }
  }

  await requireCredits(user.id, 5);

  const result = await trackGeneration(
    "cheatsheet",
    cheatSheetId,
    mode ?? "followup",
    () =>
      restartMode
        ? generateProfileCheatSheet(cheatSheetId, {
          mode: restartMode,
          instructions: followupRequest,
        })
        : createProfileCheatSheetFollowup(
          cheatSheetId,
          followupRequest,
          includeOriginalContext,
          updateContent,
          mode,
        ),
  );

  if (!result.success) return json(result, { status: 422 });
  return json(result);
};
