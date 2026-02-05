/**
 * Generate AI-assisted answers for application questions
 * Creates an ai_chat record with context from collected_data, job description, and the question
 */

import { db } from "$lib/server/db";
import { createAndGenerateAiChat } from "./utils";

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
  // Fetch the question (try block for database query)
  let question;
  try {
    question = await db.application_questions.findUnique({
      where: { id: questionId },
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
      message: `Database error fetching question: ${errorMessage}`,
    };
  }

  // Validation outside try block
  if (!question) {
    return {
      success: false,
      message: `Application question with ID ${questionId} not found`,
    };
  }

  const profileId = question.applications.profile;
  const jobDescription = question.applications.jobs?.job_description || "";

  // Generate AI chat (try block for async operation)
  let aiChatResult;
  try {
    aiChatResult = await createAndGenerateAiChat(
      profileId,
      "answer_application_question",
      {
        jobDescription: jobDescription,
        question: question.question,
      },
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

  // Update the application_questions record (try block for database update)
  try {
    await db.application_questions.update({
      where: { id: questionId },
      data: {
        ai_chat: aiChat.id,
        ai_chat_response: aiChat.response,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error updating question record: ${errorMessage}`,
    };
  }

  // Final result construction outside try block
  return {
    success: true,
    message: `Answer generated for question ID ${questionId}`,
  };
}
