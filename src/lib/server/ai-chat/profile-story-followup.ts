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
import { asc, eq } from "drizzle-orm";
import { project_stories, story_versions } from "$lib/server/db/schema";
import { createEntityFollowup, type FollowupResult } from "./entity-followup";
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

/** Recent turns as readable text, with a capped window of drafts. */
const DRAFT_WINDOW = 6;
async function buildConversationHistory(storyId: number): Promise<string> {
  const versions = await db.query.story_versions.findMany({
    where: eq(story_versions.story, storyId),
    orderBy: asc(story_versions.id),
    columns: { user_request: true, ai_feedback: true, content: true },
  });
  if (versions.length === 0) return "";
  const firstDraftIdx = Math.max(0, versions.length - DRAFT_WINDOW);

  const lines: string[] = [];
  versions.forEach((v, i) => {
    if (v.user_request) lines.push(`**You:** ${v.user_request}`);
    if (v.ai_feedback) lines.push(`**AI:** ${v.ai_feedback}`);
    if (v.content && i >= firstDraftIdx) {
      lines.push(`_The story read, after this turn:_\n${v.content}`);
    }
  });
  return lines.join("\n\n");
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

  if (mode === "review" || updateContent) {
    const story = await db.query.project_stories.findFirst({
      where: eq(project_stories.id, storyId),
    });
    if (story) {
      const currentStar = serializeStarMarkdown(story);
      // Preserve any pre-AI manual content as a baseline before this turn.
      await ensureBaselineVersion(STORY_VERSIONS, storyId, currentStar || null);
      const storyContext = buildStoryContext(story.title, story.category);

      if (mode === "review") {
        promptType = "review_star_story";
        extraVariables = {
          storyContext,
          currentStar: currentStar ||
            "(The applicant hasn't written anything yet.)",
        };
      } else {
        promptType = "followup_star_story";
        extraVariables = {
          storyContext,
          currentStar: currentStar ||
            "(The applicant hasn't written anything yet.)",
          conversationHistory: await buildConversationHistory(storyId),
        };
      }
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
