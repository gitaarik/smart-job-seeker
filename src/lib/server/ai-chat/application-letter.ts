/**
 * Generate AI-assisted letters for job applications
 * Creates an ai_chats record with applicant context in system prompt and job context in user prompt
 */

import { db } from "$lib/server/db";
import { createAndGenerateAiChat } from "./utils";
import { getFieldChoiceLabel } from "../directus/field-labels";

/**
 * Map letter types to their corresponding AI chat prompt request types
 */
const LETTER_TYPE_TO_PROMPT: Record<string, Record<string, string>> = {
  cover_letter: {
    generate: "write_cover_letter",
    advice: "advise_cover_letter",
  },
  motivation_letter: {
    generate: "write_motivation_letter",
    advice: "advise_motivation_letter",
  },
  follow_up_email: {
    generate: "write_follow_up_email",
    advice: "advise_follow_up_email",
  },
  thank_you_letter: {
    generate: "write_thank_you_letter",
    advice: "advise_thank_you_letter",
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
  additionalContext?: string,
  mode: "generate" | "advice" = "generate",
): Promise<{
  success: boolean;
  message: string;
}> {
  // Fetch the application_letter (try block for database query)
  let letter;
  try {
    letter = await db.application_letters.findUnique({
      where: { id: letterId },
      include: {
        applications: {
          include: {
            jobs: true,
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

  if (!letter.applications) {
    return {
      success: false,
      message:
        `Application letter ${letterId} does not have a linked application`,
    };
  }

  if (!letter.applications.jobs) {
    return {
      success: false,
      message: `Application for letter ${letterId} does not have a linked job`,
    };
  }

  const profileId = letter.applications.profile;
  const job = letter.applications.jobs;
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

  // Build job context (object operations and field label lookup)
  const jobDetails: Record<string, string> = {
    position: job.title || "Not specified",
    job_description: job.job_description || "Not specified",
  };

  if (job.company_description) {
    job.company = job.company_description;
  }
  if (job.import_source) {
    try {
      jobDetails.source = await getFieldChoiceLabel(
        "jobs",
        "import_source",
        job.import_source,
      );
    } catch (error) {
      // Non-critical error, continue with default value
      jobDetails.source = job.import_source;
    }
  }
  if (job.job_poster) {
    jobDetails.postedBy = job.job_poster;
  }
  if (job.date_posted) {
    jobDetails.datePosted = job.date_posted.toISOString();
  }

  // Create custom variables (object construction outside try block)
  const customVariables: Record<string, unknown> = {
    jobDescription: job.job_description || "",
    jobDetails: jobDetails,
  };

  if (additionalContext) {
    customVariables.additionalContext = additionalContext;
  }

  // Generate AI chat (try block for async operation)
  let aiChatResult;
  try {
    aiChatResult = await createAndGenerateAiChat(
      profileId,
      promptType,
      customVariables,
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
    // Extract just the letter text from structured JSON response
    let letterContent = aiChat.response;
    if (letterContent) {
      try {
        const parsed = JSON.parse(letterContent);
        if (parsed && typeof parsed.letter === "string") {
          letterContent = parsed.letter;
        }
      } catch {
        // Not JSON, use raw response as-is
      }
    }

    const updateData: Record<string, unknown> = {
      ai_chat: aiChat.id,
      ai_chat_response: aiChat.response,
    };

    // For "generate" mode, also set the content to the letter text
    if (mode === "generate") {
      updateData.content = letterContent;
    }

    await db.application_letters.update({
      where: { id: letterId },
      data: updateData,
    });
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
