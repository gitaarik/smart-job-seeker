import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { and, eq } from "drizzle-orm";
import { cheat_sheets } from "$lib/server/db/schema";
import { getSelectedProfileId } from "$lib/server/profile/selected-profile";
import { touchProfile } from "$lib/server/profile/touch-profile";
import {
  buildConversation,
  CHEATSHEET_VERSIONS,
  type ConversationEntry,
  deleteResponse,
  ensureBaselineVersion,
  recordVersionIfChanged,
  trimVersionsAfter,
  type VersionSource,
} from "$lib/server/ai-chat/entity-versions";
import { isGenerating } from "$lib/server/ai-chat/ai-generation-status";
import { htmlToMarkdown } from "$lib/utils/html-to-markdown";

export const load: PageServerLoad = async ({ parent, params }) => {
  const { selectedProfile } = await parent();
  if (!selectedProfile) error(404, "No profile selected");

  const cheatSheetId = parseInt(params.id);
  if (isNaN(cheatSheetId)) error(400, "Invalid cheat sheet ID");

  const sheet = await db.query.cheat_sheets.findFirst({
    where: and(
      eq(cheat_sheets.id, cheatSheetId),
      eq(cheat_sheets.profile_id, selectedProfile.id),
    ),
  });
  if (!sheet) error(404, "Cheat sheet not found");

  // Legacy sheets were authored as HTML; the editor works in Markdown. Normalize
  // on read (non-destructive — the stored HTML persists until the next save).
  const currentContent = htmlToMarkdown(sheet.content);

  // The version trail (oldest→newest) drives the timeline editor.
  let conversation = await buildConversation(CHEATSHEET_VERSIONS, cheatSheetId);

  // A sheet authored before the version trail existed has no version rows —
  // surface its content as an initial manual version so the timeline isn't
  // blank. Once any real version is recorded this no longer fires.
  if (conversation.length === 0 && currentContent) {
    const initial: ConversationEntry = {
      versionId: -1,
      type: "manual_edit",
      content: currentContent,
      aiFeedback: null,
      userRequest: null,
      date: sheet.date_updated ?? sheet.date_created ?? null,
    };
    conversation = [initial];
  }

  return {
    sheet: { ...sheet, content: currentContent },
    conversation,
    currentContent,
    profileId: selectedProfile.id,
    generating: await isGenerating("cheatsheet", cheatSheetId),
  };
};

/** Verify the sheet belongs to a profile the user owns; returns it or a fail. */
async function loadOwnedSheet(
  locals: App.Locals,
  cookies: import("@sveltejs/kit").Cookies,
  idRaw: string,
) {
  const user = locals.user;
  if (!user) {
    return { fail: fail(401, { error: "Not authenticated" }) } as const;
  }

  const profileId = await getSelectedProfileId(cookies, user.id);
  if (!profileId) {
    return { fail: fail(400, { error: "No profile selected" }) } as const;
  }

  const cheatSheetId = parseInt(idRaw);
  if (isNaN(cheatSheetId)) {
    return { fail: fail(400, { error: "Invalid cheat sheet ID" }) } as const;
  }

  const sheet = await db.query.cheat_sheets.findFirst({
    where: and(
      eq(cheat_sheets.id, cheatSheetId),
      eq(cheat_sheets.profile_id, profileId),
    ),
  });
  if (!sheet) return { fail: fail(404, { error: "Cheat sheet not found" }) } as const;

  return { sheet, cheatSheetId, profileId } as const;
}

export const actions: Actions = {
  // Commit content as a new version and the live sheet. The timeline's version
  // writer for manual edits + the composer's "save my version". AI turns append
  // their own versions server-side.
  save: async ({ request, locals, cookies, params }) => {
    const owned = await loadOwnedSheet(locals, cookies, params.id);
    if ("fail" in owned) return owned.fail;
    const { sheet, cheatSheetId, profileId } = owned;

    const formData = await request.formData();
    const content = (formData.get("content") as string | null)?.trim() || null;
    const deleteAfterVersionId = formData.get("deleteAfterVersionId");

    const sourceRaw = formData.get("source");
    const source: VersionSource =
      sourceRaw === "ai_generation" || sourceRaw === "ai_revision"
        ? sourceRaw
        : "manual_edit";

    if (deleteAfterVersionId) {
      const afterId = parseInt(deleteAfterVersionId as string);
      if (!isNaN(afterId)) {
        await trimVersionsAfter(CHEATSHEET_VERSIONS, cheatSheetId, afterId);
      }
    }

    // Normalize the pre-existing (possibly HTML) content to the Markdown the
    // trail stores, so the baseline round-trips with later versions.
    const previous = htmlToMarkdown(sheet.content) || null;
    await ensureBaselineVersion(CHEATSHEET_VERSIONS, cheatSheetId, previous);

    await db.update(cheat_sheets).set({
      content,
      date_updated: new Date(),
    }).where(eq(cheat_sheets.id, cheatSheetId));

    await recordVersionIfChanged(CHEATSHEET_VERSIONS, {
      entityId: cheatSheetId,
      newContent: content,
      previousContent: previous,
      source,
    });

    await touchProfile(profileId);
    return { success: true };
  },

  // Apply a specific version's content as the live sheet, without trimming later
  // versions — a non-destructive "use this version". No new version recorded.
  applyVersion: async ({ request, locals, cookies, params }) => {
    const owned = await loadOwnedSheet(locals, cookies, params.id);
    if ("fail" in owned) return owned.fail;
    const { cheatSheetId, profileId } = owned;

    const formData = await request.formData();
    const content = (formData.get("content") as string | null)?.trim() || null;
    if (!content) return fail(400, { error: "Nothing to apply" });

    await db.update(cheat_sheets).set({
      content,
      date_updated: new Date(),
    }).where(eq(cheat_sheets.id, cheatSheetId));

    await touchProfile(profileId);
    return { success: true };
  },

  // Delete a turn's AI response but keep the user's message (rewind to it), or,
  // for a message-less turn, delete it and rewind the sheet to the last version.
  clearResponse: async ({ request, locals, cookies, params }) => {
    const owned = await loadOwnedSheet(locals, cookies, params.id);
    if ("fail" in owned) return owned.fail;
    const { cheatSheetId, profileId } = owned;

    const formData = await request.formData();
    const versionId = parseInt(formData.get("versionId") as string);
    if (isNaN(versionId)) return fail(400, { error: "Invalid version" });

    const { existed, keptMessage, aiChatId, liveContent } =
      await deleteResponse(
        CHEATSHEET_VERSIONS,
        cheatSheetId,
        versionId,
      );
    if (!existed) return fail(404, { error: "Version not found" });

    await db.update(cheat_sheets).set({
      ai_chat_id: aiChatId,
      // Keep the content when a message was kept (regenerate resets it);
      // rewind it to the last remaining version on a full delete.
      ...(keptMessage ? {} : { content: liveContent }),
    }).where(eq(cheat_sheets.id, cheatSheetId));

    await touchProfile(profileId);
    return { success: true };
  },

  // Persist the title — a separate concern from content versioning.
  saveTitle: async ({ request, locals, cookies, params }) => {
    const owned = await loadOwnedSheet(locals, cookies, params.id);
    if ("fail" in owned) return owned.fail;
    const { cheatSheetId, profileId } = owned;

    const formData = await request.formData();
    const title = (formData.get("title") as string | null)?.trim();
    if (!title) return fail(400, { error: "Title cannot be empty" });

    await db.update(cheat_sheets).set({
      title,
      date_updated: new Date(),
    }).where(eq(cheat_sheets.id, cheatSheetId));

    await touchProfile(profileId);
    return { success: true };
  },
};
