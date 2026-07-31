/**
 * Follow-up AI chat for STAR project stories (profile-level interview prep).
 *
 * Mirrors application-question-followup.ts: the editor's feedback loop chains an
 * ai_chat thread and records each turn as a story_versions row through the
 * shared engine. A revision commits the STAR columns (like a question's answer);
 * a plain question/advice exchange only records the turn. The story body is
 * normalized through parse→serialize so stored versions stay canonical.
 */

import { db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { project_stories } from "$lib/server/db/schema";
import { createEntityFollowup, type FollowupResult } from "./entity-followup";
import { buildConversationMessages } from "./conversation-messages";
import {
  ensureBaselineVersion,
  recordVersion,
  STORY_VERSIONS,
} from "./entity-versions";
import { buildStoryContext, STORY_PROFILE_FIELDS } from "./profile-story";
import {
  parseStarMarkdown,
  serializeStarMarkdown,
  type StarFields,
} from "$lib/interview/star";

/** Parse a structured `{ text, feedback }` revision response. */
function parseStoryResponse(
  response: string | null,
): { text: string | null; feedback: string | null } {
  if (!response) return { text: null, feedback: null };
  try {
    const parsed = JSON.parse(response);
    const text = typeof parsed.text === "string" ? parsed.text : null;
    if (text || typeof parsed.feedback === "string") {
      return {
        text,
        feedback: typeof parsed.feedback === "string" ? parsed.feedback : null,
      };
    }
  } catch {
    // Not JSON — treat the whole thing as the revised story.
  }
  return { text: response, feedback: null };
}

/** STAR columns of a project_stories row for a DB update. */
function storyColumns(fields: StarFields) {
  return {
    situation: fields.situation,
    task: fields.task,
    action: fields.action,
    result: fields.result,
    reflection: fields.reflection,
  };
}

export async function createProfileStoryFollowup(
  storyId: number,
  followupRequest: string,
  includeOriginalContext?: boolean,
  updateContent?: boolean,
  mode?: "feedback" | "review",
): Promise<FollowupResult> {
  let promptType: string | undefined;
  let extraVariables: Record<string, unknown> | undefined;
  let historyMessages: Awaited<ReturnType<typeof buildConversationMessages>> =
    [];

  if (mode === "review" || updateContent) {
    const story = await db.query.project_stories.findFirst({
      where: eq(project_stories.id, storyId),
    });
    if (story) {
      const currentStar = serializeStarMarkdown(story);
      // Preserve any pre-AI manual content as a baseline before this turn.
      await ensureBaselineVersion(STORY_VERSIONS, storyId, currentStar || null);
      const storyContext = buildStoryContext(story.title, story.category);

      // The thread so far, replayed as real turns — for review as well as
      // revision, so a review doesn't re-suggest what was already settled.
      historyMessages = await buildConversationMessages(
        STORY_VERSIONS,
        storyId,
        { noun: "story", currentContent: currentStar },
      );

      extraVariables = {
        storyContext,
        currentStar: currentStar ||
          "(The applicant hasn't written anything yet.)",
      };
      promptType = mode === "review"
        ? "review_star_story"
        : "followup_star_story";
    }
  }

  return createEntityFollowup({
    entityId: storyId,
    entityLabel: "project story",
    noAiChatHint: "Generate the initial story first.",
    followupRequest,
    includeOriginalContext,
    promptType,
    customVariables: extraVariables,
    historyMessages,
    profileDataFields: STORY_PROFILE_FIELDS,
    fetchEntity: (id) =>
      db.query.project_stories.findFirst({
        where: eq(project_stories.id, id),
        columns: { id: true, ai_chat_id: true },
      }).then((r) => r ?? null),
    updateEntity: async (id, aiChatId, aiChatResponse) => {
      await db.update(project_stories).set({
        ai_chat_id: aiChatId,
        ai_chat_response: aiChatResponse,
      }).where(eq(project_stories.id, id));

      if (mode === "review") {
        // Review records a proposed revision as an ai_review version, but does
        // NOT commit the columns — the applicant picks it via "Use as story".
        let aiFeedback: string | null = null;
        let revised: string | null = null;
        if (aiChatResponse) {
          try {
            const parsed = JSON.parse(aiChatResponse);
            if (typeof parsed.feedback === "string") {
              aiFeedback = parsed.feedback;
              revised = typeof parsed.revisedText === "string"
                ? serializeStarMarkdown(parseStarMarkdown(parsed.revisedText))
                : null;
            }
          } catch {
            aiFeedback = aiChatResponse;
          }
        }
        await recordVersion(STORY_VERSIONS, {
          entityId: id,
          content: revised,
          source: "ai_review",
          aiChatId,
          aiFeedback,
          userRequest: followupRequest,
        });
        return;
      }

      const { text, feedback } = updateContent
        ? parseStoryResponse(aiChatResponse)
        : { text: aiChatResponse, feedback: null };

      if (updateContent && text) {
        // The model rewrote the story → a new version, committed as the live
        // story (a revision you asked for should show without a second click).
        const canonical = serializeStarMarkdown(parseStarMarkdown(text));
        await recordVersion(STORY_VERSIONS, {
          entityId: id,
          content: canonical,
          source: "ai_revision",
          aiChatId,
          aiFeedback: feedback,
          userRequest: followupRequest,
        });
        await db.update(project_stories).set({
          ...storyColumns(parseStarMarkdown(canonical)),
          date_updated: new Date(),
        }).where(eq(project_stories.id, id));
      } else if (updateContent && feedback) {
        // A question / advice exchange — record it without a new version.
        await recordVersion(STORY_VERSIONS, {
          entityId: id,
          content: null,
          source: "ai_advice",
          aiChatId,
          aiFeedback: feedback,
          userRequest: followupRequest,
        });
      }
    },
  });
}
