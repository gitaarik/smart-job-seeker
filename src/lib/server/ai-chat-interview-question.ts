/**
 * Generate AI-assisted answers for application interview questions
 * Creates an ai_chat record with context from collected_data, job description, and the question
 */

import { db } from "$lib/db";
import { generateAiChatFullPrompt } from "./ai-chat-full-prompt-generate";
import { generateAiChatResponse } from "./ai-chat-response-generate";

/**
 * Generate answer for a single application interview question
 * Steps:
 * 1. Fetch the question, application, and related data
 * 2. Create an ai_chat record with system_prompt including ${jobDescription} placeholder
 * 3. Generate the full prompt (variables will be replaced including job description)
 * 4. Generate the AI response
 * 5. Update the application_questions record with the ai_chat reference
 */
export async function generateInterviewQuestionAnswer(
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
      `Act as a helpful assistant for a SWE job seeker & applicant. Help answer questions about job descriptions, answer application questions, write cover letters etc. Below is the information about the applicant and the job description they're applying for. First the schema in JSON, after that actual data in JSON, and finally the job description. You can use the schema to find the descriptions of certain objects / fields in the data. Be brief and concise in your answer. Max 3 short paragraphs. Hiring managers usually do not have a lot of time to extensively review every text. Do not add or list any skills or knowledge which is not in the data of the applicant. You can maybe add some skills the job requires that are closely connected to skills the applicant has. Keep the story close to the real work/project experience of the applicant. Do not make up anything that is not obvious from the original info of the applicant. Don't necessarily generate complete copy-and-paste answers, but rather give suggestions for what kind of things the applicant could write. If there are multiple suitable answers, give them all, so the applicant can choose and customize to their choice.

## The schema:

\${schema}

## The data:

\${data}

## Job Description:

\${jobDescription}`;

    // Create the user prompt from the interview question
    const userPrompt =
      `Please help me answer this interview question for my application: "${question.question}"`;

    // Create the ai_chat record
    const aiChat = await db.ai_chat.create({
      data: {
        profile: profileId,
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
      },
    });

    // Generate the full prompt (this will fetch and replace all variables including jobDescription)
    const fullPromptResult = await generateAiChatFullPrompt(aiChat.id);

    if (!fullPromptResult.success) {
      return {
        success: false,
        message: `Failed to generate full prompt: ${fullPromptResult.message}`,
      };
    }

    // Generate the AI response (job description will be fetched and interpolated)
    const responseResult = await generateAiChatResponse(aiChat.id);

    if (!responseResult.success) {
      return {
        success: false,
        message: `Failed to generate response: ${responseResult.message}`,
      };
    }

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
