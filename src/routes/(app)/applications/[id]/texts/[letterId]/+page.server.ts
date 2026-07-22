import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and } from "drizzle-orm";
import { applications, application_letters } from "$lib/server/db/schema";
import { getSelectedProfileId } from "../../../../profile/utils";
import {
  buildConversation,
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

  const conversation = await buildConversation(LETTER_VERSIONS, letterId);

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
      where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
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
      where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const letter = await db.query.application_letters.findFirst({
      where: and(eq(application_letters.id, letterId), eq(application_letters.application_id, appId)),
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
      where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const letter = await db.query.application_letters.findFirst({
      where: and(eq(application_letters.id, letterId), eq(application_letters.application_id, appId)),
    });
    if (!letter) return fail(404, { error: "Letter not found" });

    await db.delete(application_letters).where(eq(application_letters.id, letterId));

    redirect(303, `/applications/${appId}/texts`);
  },
};
