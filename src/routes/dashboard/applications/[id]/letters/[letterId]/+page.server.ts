import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../../../profile/utils";

/**
 * source values for letter_versions:
 * - "manual_edit" — user edited and saved manually
 * - "ai_generation" — AI generated the letter
 * - "ai_revision" — AI revised the letter based on feedback
 * - "ai_review" — AI reviewed (feedback only, content is the user's version that was reviewed)
 * - "ai_advice" — AI gave recommendations (no letter content)
 */

export type ConversationEntry = {
  versionId: number;
  type: "manual_edit" | "ai_generation" | "ai_revision" | "ai_review" | "ai_advice";
  content?: string | null;
  aiFeedback?: string | null;
  userRequest?: string | null;
  date: Date | null;
};

export const load: PageServerLoad = async ({ parent, params }) => {
  const layoutData = await parent();
  const application = layoutData.application;

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

  // Build conversation from letter_versions table
  const versions = await db.letter_versions.findMany({
    where: { letter: letterId },
    orderBy: { id: "asc" },
    select: {
      id: true,
      date_created: true,
      content: true,
      source: true,
      ai_feedback: true,
      user_request: true,
    },
  });

  const conversation: ConversationEntry[] = versions.map((v) => ({
    versionId: v.id,
    type: v.source as ConversationEntry["type"],
    content: v.content,
    aiFeedback: v.ai_feedback,
    userRequest: v.user_request,
    date: v.date_created,
  }));

  return { letter, conversation };
};

export const actions: Actions = {
  update: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const letterId = parseInt(params.letterId);
    if (isNaN(letterId)) return fail(400, { error: "Invalid letter ID" });

    const existing = await db.applications.findFirst({
      where: { id: appId, profile: profileId },
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const letter = await db.application_letters.findFirst({
      where: { id: letterId, application: appId },
    });
    if (!letter) return fail(404, { error: "Letter not found" });

    const formData = await request.formData();
    const content = formData.get("content") as string;
    const status = formData.get("status") as string;
    const source = (formData.get("source") as string) || "manual_edit";

    // Only record a version if content actually changed
    const contentChanged = (content || null) !== (letter.content || null);

    await db.application_letters.update({
      where: { id: letterId },
      data: {
        content: content || null,
        status: status || "draft",
        date_updated: new Date(),
      },
    });

    if (contentChanged && content) {
      await db.letter_versions.create({
        data: {
          letter: letterId,
          content,
          source,
        },
      });
    }

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

    const existing = await db.applications.findFirst({
      where: { id: appId, profile: profileId },
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const letter = await db.application_letters.findFirst({
      where: { id: letterId, application: appId },
    });
    if (!letter) return fail(404, { error: "Letter not found" });

    await db.application_letters.delete({ where: { id: letterId } });

    redirect(303, `/dashboard/applications/${appId}/letters`);
  },
};
