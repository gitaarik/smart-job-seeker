import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../../../profile/utils";

export type ConversationEntry = {
  type: "generation" | "feedback" | "review";
  request?: string;
  response: string;
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

  // Build conversation history by walking the ai_chats followup_to chain
  const conversation: ConversationEntry[] = [];

  if (letter.ai_chat) {
    // Collect the chain of ai_chats from current back to root
    const chain: Array<{
      id: number;
      response: string | null;
      context: unknown;
      followup_to: number | null;
      date_created: Date | null;
    }> = [];

    let currentId: number | null = letter.ai_chat;
    while (currentId) {
      const chat = await db.ai_chats.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          response: true,
          context: true,
          followup_to: true,
          date_created: true,
        },
      });
      if (!chat) break;
      chain.push(chat);
      currentId = chat.followup_to;
    }

    // Reverse so oldest is first
    chain.reverse();

    for (const chat of chain) {
      const ctx = (chat.context as Record<string, unknown>) || {};

      if (chat.followup_to === null) {
        // Root: initial generation
        if (chat.response) {
          conversation.push({
            type: "generation",
            response: chat.response,
            date: chat.date_created,
          });
        }
      } else {
        // Followup: has a followupRequest in context
        const request = (ctx.followupRequest as string) || undefined;
        if (chat.response) {
          conversation.push({
            type: request?.toLowerCase().includes("review my changes") ? "review" : "feedback",
            request,
            response: chat.response,
            date: chat.date_created,
          });
        }
      }
    }
  }

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

    await db.application_letters.update({
      where: { id: letterId },
      data: {
        content: content || null,
        status: status || "draft",
        date_updated: new Date(),
      },
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
