/**
 * Generate AI-assisted letters for job applications
 * Creates an ai_chats record with applicant context in system prompt and job context in user prompt
 */

import { db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { application_letters } from "$lib/server/db/schema";
import { createAndGenerateAiChat, instructionsBlock } from "./utils";
import type {
  ContextSource,
  GenerationContextOption,
} from "./generation-context";
import { LETTER_PROFILE_FIELDS } from "./profile-fields";
import {
  ensureBaselineVersion,
  LETTER_VERSIONS,
  recordVersion,
} from "./entity-versions";
/**
 * Map letter types to their corresponding AI chat prompt request types
 */
const LETTER_TYPE_TO_PROMPT: Record<string, Record<string, string>> = {
  cover_letter: {
    generate: "write_cover_letter",
    advice: "advise_cover_letter",
    review: "review_cover_letter",
    // One entry point that lets the model choose draft-vs-advice per message.
    auto: "write_or_advise_cover_letter",
  },
  cheat_sheet: {
    generate: "write_cheat_sheet",
    advice: "advise_cheat_sheet",
    review: "review_cheat_sheet",
    auto: "write_or_advise_cheat_sheet",
  },
};

/**
 * Generate letter for a single application_letter
 * Steps:
 * 1. Fetch the application_letter with related application and job details
 * 2. Skip if application_letter doesn't have a linked application or job
 * 3. Determine the appropriate AI prompt based on letter_type
 * 4. Create an ai_chats record with:
 *    - system_prompt: applicant context (${schema}, ${data})
 *    - user_prompt: job context and job description (${jobDescription})
 * 5. Generate the full prompt (variables will be replaced including job description)
 * 6. Generate the AI response
 * 7. Update the application_letter record with the ai_chats reference
 * 8. If application_letter.content is empty, populate it with the generated response
 */
export async function generateApplicationLetter(
  letterId: number,
  /**
   * The applicant's own brief for this turn, typed in the editor's composer.
   * Optional — blank runs the prompt exactly as it did before. Recorded on the
   * version row so the timeline shows it as the turn's message and it can be
   * edited and regenerated.
   */
  additionalContext?: string,
  mode: "generate" | "advice" | "review" | "auto" = "generate",
): Promise<{
  success: boolean;
  message: string;
}> {
  const instructions = additionalContext?.trim() || null;
  // Fetch the application_letter (try block for database query)
  let letter;
  try {
    letter = await db.query.application_letters.findFirst({
      where: eq(application_letters.id, letterId),
      with: {
        application: {
          with: {
            job: true,
          },
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Database error fetching letter: ${errorMessage}`,
    };
  }

  // Validation outside try block
  if (!letter) {
    return {
      success: false,
      message: `Application letter with ID ${letterId} not found`,
    };
  }

  if (!letter.application) {
    return {
      success: false,
      message:
        `Application letter ${letterId} does not have a linked application`,
    };
  }

  if (!letter.application.job) {
    return {
      success: false,
      message: `Application for letter ${letterId} does not have a linked job`,
    };
  }

  const profileId = letter.application.profile_id;
  const job = letter.application.job;
  const letterType = letter.letter_type;

  // Get the appropriate prompt type based on letter type and mode
  const promptMap = LETTER_TYPE_TO_PROMPT[letterType];
  if (!promptMap) {
    return {
      success: false,
      message:
        `Unknown letter type: ${letterType}. Cannot determine which AI prompt to use.`,
    };
  }
  const promptType = promptMap[mode];
  if (!promptType) {
    return {
      success: false,
      message: `Unknown mode: ${mode} for letter type: ${letterType}.`,
    };
  }

  // What this generation draws on. The job, the recaps/feedback from earlier
  // rounds and the files on the Documents tab come from the application; the
  // ranked sources are retrieved against the job.
  //
  // Ranked sources are writing-mode only: each runs a retrieval search and only
  // the writing prompts interpolate those slots ("auto" may write a draft).
  // A cheat sheet is *about* the interviews so it gets the full record set; a
  // cover letter only needs the gist, so it gets the compact budget.
  const detail = letterType === "cheat_sheet"
    ? "full" as const
    : "compact" as const;
  const sources: ContextSource[] = [
    "job",
    "application_activity",
  ];
  if (mode === "generate" || mode === "auto") {
    sources.push("projects", "stories", "application_texts");
  }
  const context: GenerationContextOption = {
    query: {
      text: [job.title, job.job_description].filter(Boolean).join("\n"),
      skills: (job.skills_required as string[] | null) ?? undefined,
    },
    entity: { type: "application", id: letter.application.id },
    sources,
    sourceOptions: {
      application_activity: { detail },
    },
  };

  // Create custom variables (object construction outside try block)
  const customVariables: Record<string, unknown> = {
    generationMode: mode,
    additionalContext: instructionsBlock(instructions),
  };

  // For review mode, include the user's letter content
  if (mode === "review" && letter.content) {
    customVariables.letterContent = letter.content;
  }

  // Generate AI chat (try block for async operation)
  let aiChatResult;
  try {
    aiChatResult = await createAndGenerateAiChat(
      profileId,
      promptType,
      customVariables,
      undefined,
      { profileDataFields: LETTER_PROFILE_FIELDS, context },
    );
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error generating AI chat: ${errorMessage}`,
    };
  }

  // Validation outside try block
  if (!aiChatResult.success || !aiChatResult.aiChat) {
    return {
      success: false,
      message: aiChatResult.message,
    };
  }

  const aiChat = aiChatResult.aiChat;

  // Update the application_letter record (try block for database update)
  try {
    // Extract text content and feedback from structured JSON response. Generate
    // returns { text, feedback }; review returns { feedback, revisedText }.
    let letterContent = aiChat.response;
    let aiFeedback: string | null = null;
    if (letterContent) {
      try {
        const parsed = JSON.parse(letterContent);
        if (parsed && typeof parsed.feedback === "string") {
          aiFeedback = parsed.feedback;
        }
        if (parsed && typeof parsed.text === "string") {
          letterContent = parsed.text;
        } else if (parsed && typeof parsed.letter === "string") {
          // Backwards compat: older prompts may still return "letter"
          letterContent = parsed.letter;
        } else if (aiFeedback) {
          // review-style: feedback + optional revised text, no plain text
          letterContent = typeof parsed.revisedText === "string"
            ? parsed.revisedText
            : typeof parsed.revisedLetter === "string"
            ? parsed.revisedLetter
            : null;
        }
      } catch {
        // Not JSON, use raw response as-is
      }
    }

    // Preserve a pre-version-era letter as a baseline before this AI turn, so
    // the original survives instead of the AI version becoming the only one.
    await ensureBaselineVersion(LETTER_VERSIONS, letterId, letter.content);

    const updateData: Record<string, unknown> = {
      ai_chat_id: aiChat.id,
      ai_chat_response: aiChat.response,
    };

    // "generate" always writes a draft; "auto" writes one only when the model
    // produced text (it returns null when it chose to advise instead).
    if (mode === "generate" || (mode === "auto" && letterContent)) {
      updateData.content = letterContent;
    }

    await db.update(application_letters).set(updateData)
      .where(eq(application_letters.id, letterId));

    // Record a version through the shared engine.
    if (mode === "review") {
      await recordVersion(LETTER_VERSIONS, {
        entityId: letterId,
        content: letterContent,
        source: "ai_review",
        aiChatId: aiChat.id,
        aiFeedback,
      });
    } else if (mode === "advice" || (mode === "auto" && !letterContent)) {
      // No draft — just the AI's reply. Explicit "advice" returns raw markdown
      // (its whole response); "auto" chose to advise, and its reply was parsed
      // out of the JSON into aiFeedback above.
      await recordVersion(LETTER_VERSIONS, {
        entityId: letterId,
        content: null,
        source: "ai_advice",
        aiChatId: aiChat.id,
        aiFeedback: mode === "advice" ? aiChat.response : aiFeedback,
        userRequest: instructions,
      });
    } else if ((mode === "generate" || mode === "auto") && letterContent) {
      await recordVersion(LETTER_VERSIONS, {
        entityId: letterId,
        content: letterContent,
        source: "ai_generation",
        aiChatId: aiChat.id,
        aiFeedback,
        userRequest: instructions,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error updating letter record: ${errorMessage}`,
    };
  }

  // Final result construction outside try block
  return {
    success: true,
    message: `${
      letterType.replace("_", " ")
    } generated for application letter ID ${letterId}`,
  };
}
