/**
 * Generate AI-assisted letters for job applications
 * Creates an ai_chat record with applicant context in system prompt and vacancy context in user prompt
 */

import { db } from "$lib/db";
import { createAndGenerateAiChat } from "./ai-chat-utils";
import { getFieldChoiceLabel } from "./directus-field-labels";

/**
 * Map letter types to their corresponding AI chat prompt request types
 */
const LETTER_TYPE_TO_PROMPT: Record<string, string> = {
  cover_letter: "write_cover_letter",
  motivation_letter: "write_motivation_letter",
  follow_up_email: "write_follow_up_email",
  thank_you_letter: "write_thank_you_letter",
};

/**
 * Generate letter for a single application_letter
 * Steps:
 * 1. Fetch the application_letter with related application and vacancy details
 * 2. Skip if application_letter doesn't have a linked application or vacancy
 * 3. Determine the appropriate AI prompt based on letter_type
 * 4. Create an ai_chat record with:
 *    - system_prompt: applicant context (${schema}, ${data})
 *    - user_prompt: vacancy context and job description (${jobDescription})
 * 5. Generate the full prompt (variables will be replaced including job description)
 * 6. Generate the AI response
 * 7. Update the application_letter record with the ai_chat reference
 * 8. If application_letter.content is empty, populate it with the generated response
 */
export async function generateApplicationLetter(
  letterId: number,
  additionalContext?: string,
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Fetch the application_letter with related application and vacancy details
    const letter = await db.application_letters.findUnique({
      where: { id: letterId },
      include: {
        applications: {
          include: {
            vacancies: true,
          },
        },
      },
    });

    if (!letter) {
      return {
        success: false,
        message: `Application letter with ID ${letterId} not found`,
      };
    }

    // Skip if no application is linked
    if (!letter.applications) {
      return {
        success: false,
        message:
          `Application letter ${letterId} does not have a linked application`,
      };
    }

    // Skip if application has no vacancy
    if (!letter.applications.vacancies) {
      return {
        success: false,
        message:
          `Application for letter ${letterId} does not have a linked vacancy`,
      };
    }

    const profileId = letter.applications.profile;
    const vacancy = letter.applications.vacancies;
    const letterType = letter.letter_type;

    // Get the appropriate prompt type based on letter type
    const promptType = LETTER_TYPE_TO_PROMPT[letterType];
    if (!promptType) {
      return {
        success: false,
        message:
          `Unknown letter type: ${letterType}. Cannot determine which AI prompt to use.`,
      };
    }

    // Build vacancy context for custom variables
    const vacancyDetails: Record<string, string> = {
      position: vacancy.title || "Not specified",
      job_description: vacancy.job_description || "Not specified",
    };

    if (vacancy.company_description) {
      vacancyDetails.company = vacancy.company_description;
    }
    if (vacancy.import_source) {
      vacancyDetails.source = await getFieldChoiceLabel(
        "vacancies",
        "import_source",
        vacancy.import_source,
      );
    }
    if (vacancy.job_poster) {
      vacancyDetails.postedBy = vacancy.job_poster;
    }
    if (vacancy.date_posted) {
      vacancyDetails.datePosted = vacancy.date_posted.toISOString();
    }

    // Create and generate the ai_chat record using the appropriate prompt template
    const customVariables: Record<string, unknown> = {
      jobDescription: vacancy.job_description || "",
      vacancyDetails: vacancyDetails,
    };

    // Add additional context if provided
    if (additionalContext) {
      customVariables.additionalContext = additionalContext;
    }

    const aiChatResult = await createAndGenerateAiChat(
      profileId,
      promptType,
      customVariables,
    );

    if (!aiChatResult.success || !aiChatResult.aiChat) {
      return {
        success: false,
        message: aiChatResult.message,
      };
    }

    const aiChat = aiChatResult.aiChat;

    // Update the application_letter record with the ai_chat reference
    await db.application_letters.update({
      where: { id: letterId },
      data: {
        ai_chat: aiChat.id,
        ai_chat_response: aiChat.response, // Always write AI response to reference field
        // content field stays empty for user to fill
      },
    });

    return {
      success: true,
      message: `${
        letterType.replace("_", " ")
      } generated for application letter ID ${letterId}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error generating application letter: ${errorMessage}`,
    };
  }
}
