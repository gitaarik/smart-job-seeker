/**
 * Follow-up AI chat for interview cheat sheets (profile-level interview prep).
 *
 * Mirrors profile-story-followup.ts, but a cheat sheet is a single freeform
 * markdown document: the editor's feedback loop chains an ai_chat thread and
 * records each turn as a cheat_sheet_versions row through the shared engine. A
 * revision commits the `content` column; a plain question/advice exchange only
 * records the turn. Legacy HTML content is normalized to Markdown wherever it's
 * read, so the version trail stays Markdown-consistent.
 */

import { db } from "$lib/server/db";
import { asc, eq } from "drizzle-orm";
import { cheat_sheet_versions, cheat_sheets } from "$lib/server/db/schema";
import { createEntityFollowup, type FollowupResult } from "./entity-followup";
import {
  CHEATSHEET_VERSIONS,
  ensureBaselineVersion,
  recordVersion,
} from "./entity-versions";
import { buildSheetContext, CHEATSHEET_PROFILE_FIELDS } from "./profile-cheatsheet";
import { htmlToMarkdown } from "$lib/utils/html-to-markdown";

/** Parse a structured `{ text, feedback }` revision response. */
function parseSheetResponse(
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
    // Not JSON — treat the whole thing as the revised sheet.
  }
  return { text: response, feedback: null };
}

/** Recent turns as readable text, with a capped window of drafts. */
const DRAFT_WINDOW = 6;
async function buildConversationHistory(cheatSheetId: number): Promise<string> {
  const versions = await db.query.cheat_sheet_versions.findMany({
    where: eq(cheat_sheet_versions.cheat_sheet, cheatSheetId),
    orderBy: asc(cheat_sheet_versions.id),
    columns: { user_request: true, ai_feedback: true, content: true },
  });
  if (versions.length === 0) return "";
  const firstDraftIdx = Math.max(0, versions.length - DRAFT_WINDOW);

  const lines: string[] = [];
  versions.forEach((v, i) => {
    if (v.user_request) lines.push(`**You:** ${v.user_request}`);
    if (v.ai_feedback) lines.push(`**AI:** ${v.ai_feedback}`);
    if (v.content && i >= firstDraftIdx) {
      lines.push(`_The sheet read, after this turn:_\n${v.content}`);
    }
  });
  return lines.join("\n\n");
}

export async function createProfileCheatSheetFollowup(
  cheatSheetId: number,
  followupRequest: string,
  includeOriginalContext?: boolean,
  updateContent?: boolean,
  mode?: "feedback" | "review",
): Promise<FollowupResult> {
  let promptType: string | undefined;
  let extraVariables: Record<string, unknown> | undefined;

  if (mode === "review" || updateContent) {
    const sheet = await db.query.cheat_sheets.findFirst({
      where: eq(cheat_sheets.id, cheatSheetId),
    });
    if (sheet) {
      const currentContent = htmlToMarkdown(sheet.content) || null;
      // Preserve any pre-AI content as a baseline before this turn.
      await ensureBaselineVersion(
        CHEATSHEET_VERSIONS,
        cheatSheetId,
        currentContent,
      );
      const sheetContext = buildSheetContext(sheet.title);

      if (mode === "review") {
        promptType = "review_prep_sheet";
        extraVariables = {
          sheetContext,
          currentSheet: currentContent ||
            "(The applicant hasn't written anything yet.)",
        };
      } else {
        promptType = "followup_prep_sheet";
        extraVariables = {
          sheetContext,
          currentSheet: currentContent ||
            "(The applicant hasn't written anything yet.)",
          conversationHistory: await buildConversationHistory(cheatSheetId),
        };
      }
    }
  }

  return createEntityFollowup({
    entityId: cheatSheetId,
    entityLabel: "cheat sheet",
    noAiChatHint: "Generate the initial sheet first.",
    followupRequest,
    includeOriginalContext,
    promptType,
    customVariables: extraVariables,
    profileDataFields: CHEATSHEET_PROFILE_FIELDS,
    fetchEntity: (id) =>
      db.query.cheat_sheets.findFirst({
        where: eq(cheat_sheets.id, id),
        columns: { id: true, ai_chat_id: true },
      }).then((r) => r ?? null),
    updateEntity: async (id, aiChatId, aiChatResponse) => {
      await db.update(cheat_sheets).set({
        ai_chat_id: aiChatId,
        ai_chat_response: aiChatResponse,
      }).where(eq(cheat_sheets.id, id));

      if (mode === "review") {
        // Review records a proposed revision as an ai_review version, but does
        // NOT commit the column — the applicant picks it via "Use as sheet".
        let aiFeedback: string | null = null;
        let revised: string | null = null;
        if (aiChatResponse) {
          try {
            const parsed = JSON.parse(aiChatResponse);
            if (typeof parsed.feedback === "string") {
              aiFeedback = parsed.feedback;
              revised = typeof parsed.revisedText === "string"
                ? parsed.revisedText.trim() || null
                : null;
            }
          } catch {
            aiFeedback = aiChatResponse;
          }
        }
        await recordVersion(CHEATSHEET_VERSIONS, {
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
        ? parseSheetResponse(aiChatResponse)
        : { text: aiChatResponse, feedback: null };

      if (updateContent && text) {
        // The model rewrote the sheet → a new version, committed as the live
        // sheet (a revision you asked for should show without a second click).
        await recordVersion(CHEATSHEET_VERSIONS, {
          entityId: id,
          content: text.trim(),
          source: "ai_revision",
          aiChatId,
          aiFeedback: feedback,
          userRequest: followupRequest,
        });
        await db.update(cheat_sheets).set({
          content: text.trim(),
          date_updated: new Date(),
        }).where(eq(cheat_sheets.id, id));
      } else if (updateContent && feedback) {
        // A question / advice exchange — record it without a new version.
        await recordVersion(CHEATSHEET_VERSIONS, {
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
