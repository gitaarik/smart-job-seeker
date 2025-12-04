/**
 * Generate AI-assisted cover letters for job applications
 * Creates an ai_chat record with applicant context in system prompt and vacancy context in user prompt
 */

import { db } from "$lib/db";
import { createAndGenerateAiChat } from "./ai-chat-utils";

/**
 * Generate cover letter for a single application
 * Steps:
 * 1. Fetch the application with vacancy details
 * 2. Skip if application doesn't have a linked vacancy
 * 3. Create an ai_chat record with:
 *    - system_prompt: applicant context (${schema}, ${data})
 *    - user_prompt: vacancy context and job description (${jobDescription})
 * 4. Generate the full prompt (variables will be replaced including job description)
 * 5. Generate the AI response
 * 6. Update the application record with the ai_chat reference
 * 7. If application.cover_letter is empty, populate it with the generated response
 */
export async function generateApplicationCoverLetter(
  applicationId: number,
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Fetch the application with vacancy details
    const application = await db.applications.findUnique({
      where: { id: applicationId },
      include: {
        vacancies: true,
      },
    });

    if (!application) {
      return {
        success: false,
        message: `Application with ID ${applicationId} not found`,
      };
    }

    // Skip if no vacancy is linked to this application
    if (!application.vacancies) {
      return {
        success: false,
        message: `Application ${applicationId} does not have a linked vacancy`,
      };
    }

    const profileId = application.profile;
    const vacancy = application.vacancies;

    // Create system prompt with applicant context
    const systemPrompt =
      `You are an expert career coach helping a Software Engineer write a compelling, personalized cover letter.
Be professional but warm. Keep it concise (max 3 paragraphs) and compelling.

Here is the applicant's information:

## The schema:

\${schema}

## The data:

\${data}

Use this information to write a cover letter that highlights relevant experience and skills, and ensures the hiring manager sees a genuine fit for the opportunity.`;

    // Build vacancy context for user prompt
    const vacancyDetails: string[] = [];
    vacancyDetails.push(`Position: ${vacancy.title || "Not specified"}`);
    if (vacancy.company_description) {
      vacancyDetails.push(`Company: ${vacancy.company_description}`);
    }
    if (vacancy.import_source) {
      vacancyDetails.push(`Source: ${vacancy.import_source}`);
    }
    if (vacancy.job_poster) {
      vacancyDetails.push(`Posted by: ${vacancy.job_poster}`);
    }
    if (vacancy.date_posted) {
      vacancyDetails.push(`Date Posted: ${vacancy.date_posted}`);
    }

    // Create user prompt with vacancy context
    const userPrompt =
      `Please write a cover letter for the following job opportunity:

${vacancyDetails.join("\n")}

Job Description:
${vacancy.job_description}

Write a professional cover letter the applicant can customize and submit directly.`;

    // Create and generate the ai_chat record
    const aiChatResult = await createAndGenerateAiChat(
      profileId,
      systemPrompt,
      userPrompt,
    );

    if (!aiChatResult.success || !aiChatResult.aiChat) {
      return {
        success: false,
        message: aiChatResult.message,
      };
    }

    const aiChat = aiChatResult.aiChat;

    // Update the application record with the ai_chat reference
    await db.applications.update({
      where: { id: applicationId },
      data: {
        cover_letter_ai_chat: aiChat.id,
        // Only populate cover_letter if it's currently empty
        ...((!application.cover_letter ||
          application.cover_letter.trim() === "") && {
          cover_letter: aiChat.response,
        }),
      },
    });

    return {
      success: true,
      message: `Cover letter generated for application ID ${applicationId}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error generating cover letter: ${errorMessage}`,
    };
  }
}
