/**
 * Shared utilities for AI chat prompt handling
 */

import { db } from "$lib/db";

/**
 * Interpolate variables in a prompt string
 * Replaces ${schema}, ${data}, and ${jobDescription} with provided values
 */
export function interpolatePrompt(
  text: string,
  variables: { schema: string; data: string; jobDescription?: string },
): string {
  return text
    .replace(/\$\{schema\}/g, variables.schema)
    .replace(/\$\{data\}/g, variables.data)
    .replace(/\$\{jobDescription\}/g, variables.jobDescription || "");
}

/**
 * Fetch and interpolate prompts for an AI chat
 * Returns system_prompt and user_prompt with ${schema}, ${data}, and ${jobDescription} replaced
 * Attempts to fetch job description from ai_chat -> application_interview_questions -> applications -> vacancies
 */
export async function getInterpolatedPrompts(aiChatId: number): Promise<
  {
    systemPrompt: string;
    userPrompt: string;
  } | null
> {
  // Fetch the ai_chat record
  const aiChat = await db.ai_chat.findUnique({
    where: { id: aiChatId },
    select: { system_prompt: true, user_prompt: true, profile: true },
  });

  if (!aiChat) {
    return null;
  }

  // Fetch the collected_data for this profile
  const collectedData = await db.collected_data.findFirst({
    where: { profile: aiChat.profile },
    select: { schema: true, data: true },
  });

  // Try to fetch job description from the relation chain:
  // ai_chat -> application_interview_questions -> applications -> vacancies
  let jobDescription = "";
  const interviewQuestion = await db.application_interview_questions
    .findFirst({
      where: {
        ai_chat: aiChatId,
      },
      include: {
        applications: {
          include: {
            vacancies: true,
          },
        },
      },
    });

  if (interviewQuestion?.applications?.vacancies?.job_description) {
    jobDescription = interviewQuestion.applications.vacancies.job_description;
  }

  // Prepare replacements (use empty objects/strings as defaults)
  const variables = {
    schema: collectedData?.schema || "{}",
    data: collectedData?.data || "{}",
    jobDescription,
  };

  // Interpolate variables in both prompts
  const systemPrompt = interpolatePrompt(aiChat.system_prompt, variables);
  const userPrompt = interpolatePrompt(aiChat.user_prompt, variables);

  return {
    systemPrompt,
    userPrompt,
  };
}
