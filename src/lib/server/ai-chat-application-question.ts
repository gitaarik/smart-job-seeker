/**
 * Generate AI-assisted answers for application questions
 * Creates an ai_chat record with context from collected_data, job description, and the question
 */

import { db } from "$lib/db";
import { createAndGenerateAiChat } from "./ai-chat-utils";

/**
 * Generate answer for a single application question
 * Steps:
 * 1. Fetch the question, application, and related data
 * 2. Create an ai_chat record with system_prompt including ${jobDescription} placeholder
 * 3. Generate the full prompt (variables will be replaced including job description)
 * 4. Generate the AI response
 * 5. Update the application_questions record with the ai_chat reference
 */
export async function generateApplicationQuestionAnswer(
  questionId: number,
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Fetch the question with application and vacancy details
    const question = await db.application_questions.findUnique({
      where: { id: questionId },
      include: {
        applications: {
          include: {
            vacancies: true,
          },
        },
      },
    });

    if (!question) {
      return {
        success: false,
        message:
          `Application question with ID ${questionId} not found`,
      };
    }

    const profileId = question.applications.profile;

    // Fetch the job description from the vacancy
    const jobDescription = question.applications.vacancies?.job_description ||
      "";

    // Create and generate the ai_chat record using the answer_application_question prompt template
    const aiChatResult = await createAndGenerateAiChat(
      profileId,
      "answer_application_question",
      {
        jobDescription: jobDescription,
        question: question.question,
      },
    );

    if (!aiChatResult.success || !aiChatResult.aiChat) {
      return {
        success: false,
        message: aiChatResult.message,
      };
    }

    const aiChat = aiChatResult.aiChat;

    // Update the application_questions record with the ai_chat reference
    await db.application_questions.update({
      where: { id: questionId },
      data: { ai_chat: aiChat.id },
    });

    return {
      success: true,
      message: `Answer generated for question ID ${questionId}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error generating question answer: ${errorMessage}`,
    };
  }
}
