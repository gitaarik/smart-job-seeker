/**
 * Generate AI-assisted answers for application interview questions
 * Creates an ai_chat record with context from collected_data, job description, and the question
 */

import { db } from "$lib/db";
import { createAndGenerateAiChat } from "./ai-chat-utils";

/**
 * Generate answer for a single application interview question
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
    // Fetch the interview question with application and vacancy details
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
          `Application interview question with ID ${questionId} not found`,
      };
    }

    const profileId = question.applications.profile;

    // Create a system prompt that includes the job description placeholder for context
    const systemPrompt =
      `You are a career coach helping a Software Engineer prepare compelling, authentic answers to application interview questions.
Be concise and helpful. Keep answers to 2-3 short paragraphs maximum.

Here is the applicant's information:

## The schema:

\${schema}

## The data:

\${data}

## Job Description:

\${jobDescription}

Guidelines for your answer:
- Only use skills and knowledge from the applicant's actual data
- Ground answers in real work and project experience from the data
- Provide thoughtful suggestions and guidance rather than ready-to-copy answers
- When multiple suitable answers exist, present all of them with alternatives
- Use the schema to understand field descriptions and data structure
- Hiring managers have limited time - be respectful of that
- Help the applicant customize and personalize their response`;

    // Create the user prompt from the interview question
    const userPrompt =
      `Please help me answer this interview question for my application: "${question.question}"`;

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

    // Update the application_questions record with the ai_chat reference
    await db.application_questions.update({
      where: { id: questionId },
      data: { ai_chat: aiChat.id },
    });

    return {
      success: true,
      message: `Answer generated for interview question ID ${questionId}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error generating interview question answer: ${errorMessage}`,
    };
  }
}
