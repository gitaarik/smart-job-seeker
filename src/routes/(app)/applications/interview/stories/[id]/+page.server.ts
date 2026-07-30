import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { and, eq } from "drizzle-orm";
import { project_stories } from "$lib/server/db/schema";
import { getSelectedProfileId } from "$lib/server/profile/selected-profile";
import { touchProfile } from "$lib/server/profile/touch-profile";
import {
  buildConversation,
  type ConversationEntry,
  deleteResponse,
  ensureBaselineVersion,
  recordVersionIfChanged,
  STORY_VERSIONS,
  trimVersionsAfter,
  type VersionSource,
} from "$lib/server/ai-chat/entity-versions";
import { parseStarMarkdown, serializeStarMarkdown } from "$lib/interview/star";
import { isGenerating } from "$lib/server/ai-chat/ai-generation-status";

export const load: PageServerLoad = async ({ parent, params }) => {
  const { selectedProfile } = await parent();
  if (!selectedProfile) error(404, "No profile selected");

  const storyId = parseInt(params.id);
  if (isNaN(storyId)) error(400, "Invalid story ID");

  const story = await db.query.project_stories.findFirst({
    where: and(
      eq(project_stories.id, storyId),
      eq(project_stories.profile_id, selectedProfile.id),
    ),
  });
  if (!story) error(404, "Story not found");

  // The version trail (oldest→newest) drives the timeline editor.
  let conversation = await buildConversation(STORY_VERSIONS, storyId);

  // A story authored via the manual form (before any AI turn) has no version
  // rows — surface its STAR content as an initial manual version so the timeline
  // isn't blank. Once any real version is recorded this no longer fires.
  const currentStar = serializeStarMarkdown(story);
  if (conversation.length === 0 && currentStar) {
    const initial: ConversationEntry = {
      versionId: -1,
      type: "manual_edit",
      content: currentStar,
      aiFeedback: null,
      userRequest: null,
      date: story.date_updated ?? story.date_created ?? null,
    };
    conversation = [initial];
  }

  return {
    story,
    conversation,
    currentStar,
    profileId: selectedProfile.id,
    generating: await isGenerating("story", storyId),
  };
};

/** STAR columns of a project_stories row for a DB update. */
function starColumns(markdown: string | null) {
  const f = parseStarMarkdown(markdown);
  return {
    situation: f.situation,
    task: f.task,
    action: f.action,
    result: f.result,
    reflection: f.reflection,
  };
}

/** Verify the story belongs to a profile the user owns; returns it or a fail. */
async function loadOwnedStory(
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

  const storyId = parseInt(idRaw);
  if (isNaN(storyId)) {
    return { fail: fail(400, { error: "Invalid story ID" }) } as const;
  }

  const story = await db.query.project_stories.findFirst({
    where: and(
      eq(project_stories.id, storyId),
      eq(project_stories.profile_id, profileId),
    ),
  });
  if (!story) return { fail: fail(404, { error: "Story not found" }) } as const;

  return { story, storyId, profileId } as const;
}

export const actions: Actions = {
  // Commit STAR content as a new version and the live story. The timeline's
  // version writer for manual edits + the composer's "save my version". AI turns
  // append their own versions server-side.
  save: async ({ request, locals, cookies, params }) => {
    const owned = await loadOwnedStory(locals, cookies, params.id);
    if ("fail" in owned) return owned.fail;
    const { story, storyId, profileId } = owned;

    const formData = await request.formData();
    const raw = (formData.get("content") as string | null) ?? "";
    // Normalize to canonical STAR markdown so it round-trips with the columns.
    const content = serializeStarMarkdown(parseStarMarkdown(raw)) || null;
    const deleteAfterVersionId = formData.get("deleteAfterVersionId");

    const sourceRaw = formData.get("source");
    const source: VersionSource =
      sourceRaw === "ai_generation" || sourceRaw === "ai_revision"
        ? sourceRaw
        : "manual_edit";

    if (deleteAfterVersionId) {
      const afterId = parseInt(deleteAfterVersionId as string);
      if (!isNaN(afterId)) {
        await trimVersionsAfter(STORY_VERSIONS, storyId, afterId);
      }
    }

    const previousStar = serializeStarMarkdown(story);
    await ensureBaselineVersion(STORY_VERSIONS, storyId, previousStar || null);

    await db.update(project_stories).set({
      ...starColumns(content),
      date_updated: new Date(),
    }).where(eq(project_stories.id, storyId));

    await recordVersionIfChanged(STORY_VERSIONS, {
      entityId: storyId,
      newContent: content,
      previousContent: previousStar || null,
      source,
    });

    await touchProfile(profileId);
    return { success: true };
  },

  // Apply a specific version's content as the live story, without trimming later
  // versions — a non-destructive "use this version". No new version recorded.
  applyVersion: async ({ request, locals, cookies, params }) => {
    const owned = await loadOwnedStory(locals, cookies, params.id);
    if ("fail" in owned) return owned.fail;
    const { storyId, profileId } = owned;

    const formData = await request.formData();
    const content = (formData.get("content") as string | null)?.trim() || null;
    if (!content) return fail(400, { error: "Nothing to apply" });

    await db.update(project_stories).set({
      ...starColumns(content),
      date_updated: new Date(),
    }).where(eq(project_stories.id, storyId));

    await touchProfile(profileId);
    return { success: true };
  },

  // Delete a turn's AI response but keep the user's message (rewind to it), or,
  // for a message-less turn, delete it and rewind the story to the last version.
  clearResponse: async ({ request, locals, cookies, params }) => {
    const owned = await loadOwnedStory(locals, cookies, params.id);
    if ("fail" in owned) return owned.fail;
    const { storyId, profileId } = owned;

    const formData = await request.formData();
    const versionId = parseInt(formData.get("versionId") as string);
    if (isNaN(versionId)) return fail(400, { error: "Invalid version" });

    const { existed, keptMessage, aiChatId, liveContent } =
      await deleteResponse(
        STORY_VERSIONS,
        storyId,
        versionId,
      );
    if (!existed) return fail(404, { error: "Version not found" });

    await db.update(project_stories).set({
      ai_chat_id: aiChatId,
      // Keep the columns when a message was kept (regenerate resets them);
      // rewind them to the last remaining version on a full delete.
      ...(keptMessage ? {} : starColumns(liveContent)),
    }).where(eq(project_stories.id, storyId));

    await touchProfile(profileId);
    return { success: true };
  },

  // Persist title + category — a separate concern from STAR versioning.
  saveMeta: async ({ request, locals, cookies, params }) => {
    const owned = await loadOwnedStory(locals, cookies, params.id);
    if ("fail" in owned) return owned.fail;
    const { storyId, profileId } = owned;

    const formData = await request.formData();
    const title = (formData.get("title") as string | null)?.trim();
    const category = (formData.get("category") as string | null)?.trim() ||
      null;
    if (!title) return fail(400, { error: "Title cannot be empty" });

    await db.update(project_stories).set({
      title,
      category,
      date_updated: new Date(),
    }).where(eq(project_stories.id, storyId));

    await touchProfile(profileId);
    return { success: true };
  },
};
