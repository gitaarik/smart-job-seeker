/**
 * Generate AI-assisted STAR project stories (profile-level interview prep).
 *
 * Mirrors application-question.ts, but a story is PROFILE-scoped, not tied to a
 * job: the context is the applicant's own experience (work history, projects),
 * and the artifact is a five-section STAR narrative carried through the version
 * trail as one canonical markdown document (see $lib/interview/star).
 *
 * generate/revision commit the STAR columns straight away (like a question's
 * answer); advice/review only record a version for the timeline to render.
 */

import { db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { project_stories } from "$lib/server/db/schema";
import { createAndGenerateAiChat, instructionsBlock } from "./utils";
import {
  ensureBaselineVersion,
  recordVersion,
  STORY_VERSIONS,
} from "./entity-versions";
import {
  parseStarMarkdown,
  serializeStarMarkdown,
  type StarFields,
} from "$lib/interview/star";

/** Profile data fields relevant for building a behavioural STAR story. */
export const STORY_PROFILE_FIELDS = [
  "name",
  "title",
  "headline",
  "subtitle",
  "summary",
  "core_stack",
  "highlights",
  "work_experiences",
  "side_projects",
  "education",
  "tech_skill_categories",
  "project_stories",
];

/** Maps generation mode to the prompt template name. */
const STORY_MODE_TO_PROMPT: Record<string, string> = {
  generate: "write_star_story",
  advice: "advise_star_story",
  review: "review_star_story",
};

/**
 * Titles that mean "not really named yet" — an empty title or one of the
 * placeholders the "Build with AI" entry point creates a row with. A generate
 * turn is allowed to overwrite these with the model's suggested title.
 */
const PLACEHOLDER_TITLES = new Set(["new story", "untitled story", "untitled"]);
function isUnnamed(title: string | null): boolean {
  const t = title?.trim().toLowerCase();
  return !t || PLACEHOLDER_TITLES.has(t);
}

/** The STAR columns of a project_stories row, as the parser/serializer sees them. */
function storyColumns(fields: StarFields) {
  return {
    situation: fields.situation,
    task: fields.task,
    action: fields.action,
    result: fields.result,
    reflection: fields.reflection,
  };
}

/**
 * A human-readable brief of what this story is about, injected as
 * `${storyContext}`. Blank title → tell the model to pick the most compelling
 * story from the profile itself.
 */
export function buildStoryContext(
  title: string | null,
  category: string | null,
): string {
  const lines: string[] = [];
  if (title?.trim()) lines.push(`Working title: ${title.trim()}`);
  if (category?.trim()) {
    lines.push(`Theme / category: ${category.trim().replace(/_/g, " ")}`);
  }
  if (lines.length === 0) {
    return "The applicant hasn't named this story yet — choose the single most compelling story from their real experience for a behavioural interview.";
  }
  return lines.join("\n");
}

/**
 * Generate / advise on / review a STAR story.
 *
 * @param storyId project_stories row id
 * @param opts.mode  "generate" writes the story, "advice" returns pointers (no
 *   content), "review" critiques the current story and may propose a revision.
 * @param opts.instructions the applicant's own brief for this turn (composer).
 */
export async function generateProfileStory(
  storyId: number,
  opts?: {
    mode?: "generate" | "advice" | "review";
    instructions?: string;
  },
): Promise<{ success: boolean; message: string; text?: string }> {
  const mode = opts?.mode ?? "generate";
  const promptType = STORY_MODE_TO_PROMPT[mode];
  const instructions = opts?.instructions?.trim() || null;

  let story;
  try {
    story = await db.query.project_stories.findFirst({
      where: eq(project_stories.id, storyId),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Database error fetching story: ${msg}` };
  }

  if (!story) {
    return { success: false, message: `Story with ID ${storyId} not found` };
  }

  const profileId = story.profile_id;
  const currentStar = serializeStarMarkdown(story);

  const variables: Record<string, unknown> = {
    storyContext: buildStoryContext(story.title, story.category),
  };
  if (mode === "review") {
    variables.currentStar = currentStar ||
      "(The applicant hasn't written anything yet.)";
  } else {
    variables.additionalContext = instructionsBlock(instructions);
  }

  let aiChatResult;
  try {
    aiChatResult = await createAndGenerateAiChat(
      profileId,
      promptType,
      variables,
      undefined,
      { profileDataFields: STORY_PROFILE_FIELDS },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Error generating AI chat: ${msg}` };
  }

  if (!aiChatResult.success || !aiChatResult.aiChat) {
    return { success: false, message: aiChatResult.message };
  }
  const aiChat = aiChatResult.aiChat;

  // Extract per mode. generate → { text, feedback, title }; advice → plain text;
  // review → { feedback, revisedText }. The story body is normalized through
  // parse→serialize so every stored version is canonical STAR markdown.
  let storyMarkdown: string | null = null;
  let aiFeedback: string | null = null;
  let suggestedTitle: string | null = null;
  if (mode === "advice") {
    aiFeedback = aiChat.response;
  } else if (aiChat.response) {
    try {
      const parsed = JSON.parse(aiChat.response);
      if (typeof parsed.feedback === "string") aiFeedback = parsed.feedback;
      const raw = mode === "review" ? parsed.revisedText : parsed.text;
      if (typeof raw === "string" && raw.trim()) {
        storyMarkdown = serializeStarMarkdown(parseStarMarkdown(raw));
      }
      if (mode === "generate" && typeof parsed.title === "string") {
        suggestedTitle = parsed.title.trim() || null;
      }
    } catch {
      // Non-JSON response: treat the whole thing as the story body (generate) or
      // as feedback (review), degrading rather than failing.
      if (mode === "review") {
        aiFeedback = aiChat.response;
      } else {
        storyMarkdown = serializeStarMarkdown(
          parseStarMarkdown(aiChat.response),
        );
      }
    }
  }

  try {
    // Preserve any pre-AI manual STAR content as a baseline version first.
    await ensureBaselineVersion(STORY_VERSIONS, storyId, currentStar || null);

    const commitColumns = mode === "generate" && storyMarkdown;
    await db.update(project_stories).set({
      ai_chat_id: aiChat.id,
      ai_chat_response: aiChat.response,
      ...(commitColumns
        ? {
          ...storyColumns(parseStarMarkdown(storyMarkdown)),
          date_updated: new Date(),
          // Name an as-yet-unnamed story from the model's suggestion.
          ...(suggestedTitle && isUnnamed(story.title)
            ? { title: suggestedTitle }
            : {}),
        }
        : {}),
    }).where(eq(project_stories.id, storyId));

    if (mode === "review") {
      await recordVersion(STORY_VERSIONS, {
        entityId: storyId,
        content: storyMarkdown,
        source: "ai_review",
        aiChatId: aiChat.id,
        aiFeedback,
      });
    } else if (mode === "advice") {
      await recordVersion(STORY_VERSIONS, {
        entityId: storyId,
        content: null,
        source: "ai_advice",
        aiChatId: aiChat.id,
        aiFeedback,
        userRequest: instructions,
      });
    } else if (mode === "generate" && storyMarkdown) {
      await recordVersion(STORY_VERSIONS, {
        entityId: storyId,
        content: storyMarkdown,
        source: "ai_generation",
        aiChatId: aiChat.id,
        aiFeedback,
        userRequest: instructions,
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Error updating story record: ${msg}` };
  }

  return {
    success: true,
    message: `Story ${mode} completed for story ID ${storyId}`,
    text: storyMarkdown ?? undefined,
  };
}
