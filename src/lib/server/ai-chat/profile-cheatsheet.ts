/**
 * Generate AI-assisted interview cheat sheets (profile-level interview prep).
 *
 * Mirrors profile-story.ts, but a cheat sheet is a single freeform markdown
 * document (not five STAR columns): a reusable, scannable quick-reference note
 * the applicant reviews before / glances at during interviews. Like a story it
 * is PROFILE-scoped, not tied to a job — the context is the applicant's own
 * experience, plus the sheet's topic (its title).
 *
 * generate/revision commit the `content` column straight away; advice/review
 * only record a version for the timeline to render. Legacy sheets were authored
 * as HTML in a rich-text editor, so the current content is normalized to
 * Markdown (htmlToMarkdown) wherever it's read as the baseline or fed to a
 * prompt — the version trail stays Markdown-consistent.
 */

import { db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { cheat_sheets } from "$lib/server/db/schema";
import { createAndGenerateAiChat, instructionsBlock } from "./utils";
import {
  CHEATSHEET_VERSIONS,
  ensureBaselineVersion,
  recordVersion,
} from "./entity-versions";
import { htmlToMarkdown } from "$lib/utils/html-to-markdown";
import {
  assembleGenerationContext,
  type RelevanceQuery,
} from "./generation-context";

/** Profile data fields relevant for building an interview cheat sheet. */
export const CHEATSHEET_PROFILE_FIELDS = [
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
  "languages",
];

/** Maps generation mode to the prompt template name. */
const CHEATSHEET_MODE_TO_PROMPT: Record<string, string> = {
  generate: "write_prep_sheet",
  advice: "advise_prep_sheet",
  review: "review_prep_sheet",
  // One entry point; the model picks draft-vs-advice per message.
  auto: "write_or_advise_prep_sheet",
};

/**
 * Titles that mean "not really named yet" — an empty title or one of the
 * placeholders the "Add cheat sheet" entry point creates a row with. A generate
 * turn is allowed to overwrite these with the model's suggested title.
 */
const PLACEHOLDER_TITLES = new Set([
  "new cheat sheet",
  "untitled",
  "untitled cheat sheet",
]);
function isUnnamed(title: string | null): boolean {
  const t = title?.trim().toLowerCase();
  return !t || PLACEHOLDER_TITLES.has(t);
}

/**
 * A human-readable brief of what this sheet is about, injected as
 * `${sheetContext}`. Blank title → tell the model to infer a useful topic from
 * the profile itself and suggest a title.
 */
export function buildSheetContext(title: string | null): string {
  if (title?.trim() && !isUnnamed(title)) {
    return `Topic / title: ${title.trim()}`;
  }
  return "The applicant hasn't titled this cheat sheet yet — infer a useful interview-prep reference topic from their profile (their core stack, strengths, likely tough questions) and suggest a title.";
}

/**
 * Generate / advise on / review an interview cheat sheet.
 *
 * @param cheatSheetId cheat_sheets row id
 * @param opts.mode  "generate" writes the sheet, "advice" returns pointers (no
 *   content), "review" critiques the current sheet and may propose a revision.
 * @param opts.instructions the applicant's own brief for this turn (composer).
 */
export async function generateProfileCheatSheet(
  cheatSheetId: number,
  opts?: {
    mode?: "generate" | "advice" | "review" | "auto";
    instructions?: string;
  },
): Promise<{ success: boolean; message: string; text?: string }> {
  const mode = opts?.mode ?? "generate";
  const promptType = CHEATSHEET_MODE_TO_PROMPT[mode];
  const instructions = opts?.instructions?.trim() || null;

  let sheet;
  try {
    sheet = await db.query.cheat_sheets.findFirst({
      where: eq(cheat_sheets.id, cheatSheetId),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      message: `Database error fetching cheat sheet: ${msg}`,
    };
  }

  if (!sheet) {
    return {
      success: false,
      message: `Cheat sheet with ID ${cheatSheetId} not found`,
    };
  }

  const profileId = sheet.profile_id;
  const currentContent = htmlToMarkdown(sheet.content) || null;

  const variables: Record<string, unknown> = {
    sheetContext: buildSheetContext(sheet.title),
  };
  if (mode === "review") {
    variables.currentSheet = currentContent ||
      "(The applicant hasn't written anything yet.)";
  } else {
    variables.additionalContext = instructionsBlock(instructions);
  }

  // Ground the sheet in the applicant's most relevant REAL projects, but only
  // for the draft-writing modes: advice/review templates never interpolate
  // ${relevantProjects}, so retrieving there would spend an embedding search on
  // a discarded result (see the drift-guard test). The relevance query is what
  // this sheet is *about* — its topic (title), the applicant's brief this turn,
  // and whatever is already on the sheet. The provider owns the retrieval and
  // budgeting, so new evidence sources (other stories, past letters, repo
  // recaps) will feed cheat sheets by extending the SOURCES registry, not here.
  if (mode === "generate" || mode === "auto") {
    const topic = sheet.title && !isUnnamed(sheet.title) ? sheet.title : "";
    const query: RelevanceQuery = {
      text: [topic, instructions ?? "", currentContent ?? ""]
        .filter(Boolean)
        .join("\n"),
    };
    const ctx = await assembleGenerationContext({
      profileId,
      query,
      sources: ["projects"],
    });
    Object.assign(variables, ctx.variables);
  }

  let aiChatResult;
  try {
    aiChatResult = await createAndGenerateAiChat(
      profileId,
      promptType,
      variables,
      undefined,
      { profileDataFields: CHEATSHEET_PROFILE_FIELDS },
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
  // review → { feedback, revisedText }.
  let sheetContent: string | null = null;
  let aiFeedback: string | null = null;
  let suggestedTitle: string | null = null;
  if (mode === "advice") {
    aiFeedback = aiChat.response;
  } else if (aiChat.response) {
    try {
      const parsed = JSON.parse(aiChat.response);
      if (typeof parsed.feedback === "string") aiFeedback = parsed.feedback;
      const raw = mode === "review" ? parsed.revisedText : parsed.text;
      if (typeof raw === "string" && raw.trim()) sheetContent = raw.trim();
      if (
        (mode === "generate" || mode === "auto") &&
        typeof parsed.title === "string"
      ) {
        suggestedTitle = parsed.title.trim() || null;
      }
    } catch {
      // Non-JSON response: treat the whole thing as the sheet body (generate) or
      // as feedback (review), degrading rather than failing.
      if (mode === "review") {
        aiFeedback = aiChat.response;
      } else {
        sheetContent = aiChat.response.trim();
      }
    }
  }

  try {
    // Preserve any pre-AI content (normalized to Markdown) as a baseline first.
    await ensureBaselineVersion(
      CHEATSHEET_VERSIONS,
      cheatSheetId,
      currentContent,
    );

    const commitContent = (mode === "generate" || mode === "auto") &&
      sheetContent;
    await db.update(cheat_sheets).set({
      ai_chat_id: aiChat.id,
      ai_chat_response: aiChat.response,
      ...(commitContent
        ? {
          content: sheetContent,
          date_updated: new Date(),
          // Name an as-yet-unnamed sheet from the model's suggestion.
          ...(suggestedTitle && isUnnamed(sheet.title)
            ? { title: suggestedTitle }
            : {}),
        }
        : {}),
    }).where(eq(cheat_sheets.id, cheatSheetId));

    if (mode === "review") {
      await recordVersion(CHEATSHEET_VERSIONS, {
        entityId: cheatSheetId,
        content: sheetContent,
        source: "ai_review",
        aiChatId: aiChat.id,
        aiFeedback,
      });
    } else if (mode === "advice" || (mode === "auto" && !sheetContent)) {
      await recordVersion(CHEATSHEET_VERSIONS, {
        entityId: cheatSheetId,
        content: null,
        source: "ai_advice",
        aiChatId: aiChat.id,
        aiFeedback,
        userRequest: instructions,
      });
    } else if ((mode === "generate" || mode === "auto") && sheetContent) {
      await recordVersion(CHEATSHEET_VERSIONS, {
        entityId: cheatSheetId,
        content: sheetContent,
        source: "ai_generation",
        aiChatId: aiChat.id,
        aiFeedback,
        userRequest: instructions,
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      message: `Error updating cheat sheet record: ${msg}`,
    };
  }

  return {
    success: true,
    message: `Cheat sheet ${mode} completed for cheat sheet ID ${cheatSheetId}`,
    text: sheetContent ?? undefined,
  };
}
