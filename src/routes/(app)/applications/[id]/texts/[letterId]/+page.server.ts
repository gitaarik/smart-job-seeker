import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { and, eq } from "drizzle-orm";
import { application_letters, applications } from "$lib/server/db/schema";
import { getSelectedProfileId } from "../../../../profile/utils";
import {
  buildConversation,
  type ConversationEntry,
  deleteResponse,
  ensureBaselineVersion,
  LETTER_VERSIONS,
  recordVersion,
  recordVersionIfChanged,
  trimVersionsAfter,
  type VersionSource,
} from "$lib/server/ai-chat/entity-versions";

// Version `source` values and the ConversationEntry shape live in the shared
// engine; re-export the type so +page.svelte keeps importing it from here.
export type { ConversationEntry } from "$lib/server/ai-chat/entity-versions";

export const load: PageServerLoad = async ({ parent, params, url }) => {
  const layoutData = await parent();
  const application = layoutData.application;

  // Handle "new" letter (not yet created in DB)
  if (params.letterId === "new") {
    const letterType = url.searchParams.get("type") || "cover_letter";
    return {
      isNew: true,
      letter: {
        id: 0,
        letter_type: letterType,
        status: "draft",
        content: null,
        ai_chat_id: null,
        ai_chat_response: null,
        date_created: new Date(),
        date_updated: null,
      },
      conversation: [],
    };
  }

  const letterId = parseInt(params.letterId);
  if (isNaN(letterId)) {
    error(400, "Invalid letter ID");
  }

  const letter = application.application_letters.find(
    (l) => l.id === letterId,
  );

  if (!letter) {
    error(404, "Letter not found");
  }

  let conversation = await buildConversation(LETTER_VERSIONS, letterId);

  // Letters written before the version trail existed have no rows — surface the
  // saved content as an initial version so the timeline isn't blank. The first
  // AI/save turn persists this baseline for real (ensureBaselineVersion).
  if (conversation.length === 0 && letter.content) {
    const initial: ConversationEntry = {
      versionId: -1,
      type: "manual_edit",
      content: letter.content,
      aiFeedback: null,
      userRequest: null,
      date: letter.date_updated ?? letter.date_created ?? null,
    };
    conversation = [initial];
  }

  return { isNew: false, letter, conversation };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const existing = await db.query.applications.findFirst({
      where: and(
        eq(applications.id, appId),
        eq(applications.profile_id, profileId),
      ),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const letterType = formData.get("letter_type") as string;
    const content = formData.get("content") as string | null;
    const source = (formData.get("source") as string) || "manual_edit";

    if (!letterType) return fail(400, { error: "Letter type is required" });

    const [newLetter] = await db.insert(application_letters).values({
      application_id: appId,
      letter_type: letterType,
      content: content || null,
      status: "draft",
      date_created: new Date(),
    }).returning();

    // If content was provided, also create a version
    if (content) {
      await recordVersion(LETTER_VERSIONS, {
        entityId: newLetter.id,
        content,
        source: source as VersionSource,
      });
    }

    redirect(303, `/applications/${appId}/texts/${newLetter.id}`);
  },

  update: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const letterId = parseInt(params.letterId);
    if (isNaN(letterId)) return fail(400, { error: "Invalid letter ID" });

    const existing = await db.query.applications.findFirst({
      where: and(
        eq(applications.id, appId),
        eq(applications.profile_id, profileId),
      ),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const letter = await db.query.application_letters.findFirst({
      where: and(
        eq(application_letters.id, letterId),
        eq(application_letters.application_id, appId),
      ),
    });
    if (!letter) return fail(404, { error: "Letter not found" });

    const formData = await request.formData();
    const content = formData.get("content") as string;
    const status = formData.get("status") as string;
    const source = (formData.get("source") as string) || "manual_edit";
    const deleteAfterVersionId = formData.get("deleteAfterVersionId");

    // If saving a previous version, delete all versions after it first
    if (deleteAfterVersionId) {
      const afterId = parseInt(deleteAfterVersionId as string);
      if (!isNaN(afterId)) {
        await trimVersionsAfter(LETTER_VERSIONS, letterId, afterId);
      }
    }

    // Preserve a pre-version-era letter as a baseline before recording this save.
    await ensureBaselineVersion(LETTER_VERSIONS, letterId, letter.content);

    await db.update(application_letters).set({
      content: content || null,
      status: status || "draft",
      date_updated: new Date(),
    }).where(eq(application_letters.id, letterId));

    // Only records when content actually changed and is non-empty.
    await recordVersionIfChanged(LETTER_VERSIONS, {
      entityId: letterId,
      newContent: content || null,
      previousContent: letter.content,
      source: source as VersionSource,
    });

    return { success: true };
  },

  clearResponse: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const letterId = parseInt(params.letterId);
    if (isNaN(letterId)) return fail(400, { error: "Invalid letter ID" });

    const existing = await db.query.applications.findFirst({
      where: and(
        eq(applications.id, appId),
        eq(applications.profile_id, profileId),
      ),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const letter = await db.query.application_letters.findFirst({
      where: and(
        eq(application_letters.id, letterId),
        eq(application_letters.application_id, appId),
      ),
    });
    if (!letter) return fail(404, { error: "Letter not found" });

    const formData = await request.formData();
    const versionId = parseInt(formData.get("versionId") as string);
    if (isNaN(versionId)) return fail(400, { error: "Invalid version" });

    const { existed, keptMessage, aiChatId, liveContent } =
      await deleteResponse(
        LETTER_VERSIONS,
        letterId,
        versionId,
      );
    if (!existed) return fail(404, { error: "Version not found" });

    await db.update(application_letters).set({
      ai_chat_id: aiChatId,
      ...(keptMessage ? {} : { content: liveContent }),
    }).where(eq(application_letters.id, letterId));

    return { success: true };
  },

  delete: async ({ locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const letterId = parseInt(params.letterId);
    if (isNaN(letterId)) return fail(400, { error: "Invalid letter ID" });

    const existing = await db.query.applications.findFirst({
      where: and(
        eq(applications.id, appId),
        eq(applications.profile_id, profileId),
      ),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const letter = await db.query.application_letters.findFirst({
      where: and(
        eq(application_letters.id, letterId),
        eq(application_letters.application_id, appId),
      ),
    });
    if (!letter) return fail(404, { error: "Letter not found" });

    await db.delete(application_letters).where(
      eq(application_letters.id, letterId),
    );

    redirect(303, `/applications/${appId}/texts`);
  },
};
