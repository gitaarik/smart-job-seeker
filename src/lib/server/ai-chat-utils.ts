/**
 * Shared utilities for AI chat prompt handling
 */

import { db } from "$lib/db";
import { generateAiChatFullPrompt } from "./ai-chat-full-prompt-generate";
import { generateAiChatResponse } from "./ai-chat-response-generate";
import { getEnv } from "$lib/tools/get-env";
import Groq from "groq-sdk";

/**
 * Interpolate variables in a prompt string
 * Replaces ${variableName} placeholders with provided values
 * Supports any number of variables passed as key-value pairs
 */
export function interpolatePrompt(
  text: string,
  variables: Record<string, string>,
): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\$\\{${key}\\}`, "g");
    result = result.replace(regex, value);
  }
  return result;
}

/**
 * Fetch prompt template from ai_chat_prompts by request identifier
 * Returns null if template not found or if prompts are missing
 */
async function fetchPromptTemplate(
  request: string,
): Promise<
  {
    system_prompt: string;
    user_prompt: string;
  } | null
> {
  const template = await db.ai_chat_prompts.findUnique({
    where: { request },
    select: {
      system_prompt: true,
      user_prompt: true,
    },
  });

  if (!template?.system_prompt || !template?.user_prompt) {
    return null;
  }

  return {
    system_prompt: template.system_prompt,
    user_prompt: template.user_prompt,
  };
}

/**
 * Fetch and interpolate prompts for an AI chat
 * Returns system_prompt and user_prompt with ${schema} and ${data} replaced
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

  // Prepare replacements (use empty objects as defaults)
  const variables = {
    schema: collectedData?.schema || "{}",
    data: collectedData?.data || "{}",
  };

  // Interpolate variables in both prompts
  const systemPrompt = interpolatePrompt(aiChat.system_prompt, variables);
  const userPrompt = interpolatePrompt(aiChat.user_prompt, variables);

  return {
    systemPrompt,
    userPrompt,
  };
}

/**
 * Create and fully generate an AI chat instance using prompt templates from ai_chat_prompts
 * Orchestrates the entire process:
 * 1. Fetches prompt template from ai_chat_prompts by request identifier
 * 2. Fetches collected_data for the profile to get schema and data
 * 3. Merges standard variables (schema, data) with custom variables
 * 4. Interpolates prompts with all variables
 * 5. Creates ai_chat record with template prompts (containing placeholders)
 * 6. Saves interpolated full_prompt
 * 7. Generates response via Groq API with interpolated prompts
 * 8. Returns the complete ai_chat record
 *
 * @param profileId - The profile ID for this AI chat
 * @param promptRequest - The unique request identifier from ai_chat_prompts table
 * @param customVariables - Optional custom variables for interpolation (e.g., {jobDescription: "..."})
 * @returns Object with success status, message, and the created ai_chat record (if successful)
 */
export async function createAndGenerateAiChat(
  profileId: number,
  promptRequest: string,
  customVariables?: Record<string, string>,
): Promise<{
  success: boolean;
  message: string;
  aiChat?: {
    id: number;
    profile: number;
    system_prompt: string;
    user_prompt: string;
    full_prompt: string | null;
    response: string | null;
    date_created: Date | null;
    date_updated: Date | null;
  };
}> {
  try {
    // Step 1: Fetch prompt template from ai_chat_prompts
    const promptTemplate = await fetchPromptTemplate(promptRequest);

    if (!promptTemplate) {
      return {
        success: false,
        message:
          `AI chat prompt template not found for request: '${promptRequest}'. Please ensure the template exists in Directus.`,
      };
    }

    // Step 2: Fetch collected_data for the profile
    const collectedData = await db.collected_data.findFirst({
      where: { profile: profileId },
      select: { schema: true, data: true },
    });

    // Step 3: Merge all variables (standard + custom)
    const allVariables: Record<string, string> = {
      schema: collectedData?.schema || "{}",
      data: collectedData?.data || "{}",
      ...(customVariables || {}),
    };

    // Step 4: Interpolate both prompts with all variables
    const interpolatedSystemPrompt = interpolatePrompt(
      promptTemplate.system_prompt,
      allVariables,
    );
    const interpolatedUserPrompt = interpolatePrompt(
      promptTemplate.user_prompt,
      allVariables,
    );

    // Step 5: Create the ai_chat record with template prompts (not interpolated)
    const aiChat = await db.ai_chat.create({
      data: {
        profile: profileId,
        system_prompt: promptTemplate.system_prompt,
        user_prompt: promptTemplate.user_prompt,
        date_created: new Date(),
      },
    });

    // Step 6: Generate and save full_prompt (interpolated combination)
    const fullPrompt =
      `${interpolatedSystemPrompt}\n\n## User prompt:\n\n${interpolatedUserPrompt}`;

    await db.ai_chat.update({
      where: { id: aiChat.id },
      data: { full_prompt: fullPrompt },
    });

    // Step 7: Generate AI response via Groq API
    const groq = new Groq({
      apiKey: getEnv("GROQ_API_KEY", ""),
    });

    const completion = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "system",
          content: interpolatedSystemPrompt,
        },
        {
          role: "user",
          content: interpolatedUserPrompt,
        },
      ],
      max_tokens: 2048,
      temperature: 0.7,
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      return {
        success: false,
        message: `No response generated for AI chat ID ${aiChat.id}`,
      };
    }

    // Step 8: Save response
    await db.ai_chat.update({
      where: { id: aiChat.id },
      data: { response: responseContent },
    });

    // Step 9: Fetch and return the complete ai_chat record
    const completeAiChat = await db.ai_chat.findUnique({
      where: { id: aiChat.id },
      select: {
        id: true,
        profile: true,
        system_prompt: true,
        user_prompt: true,
        full_prompt: true,
        response: true,
        date_created: true,
        date_updated: true,
      },
    });

    if (!completeAiChat) {
      return {
        success: false,
        message:
          `Failed to retrieve created ai_chat record with ID ${aiChat.id}`,
      };
    }

    return {
      success: true,
      message: `AI chat created and generated successfully`,
      aiChat: completeAiChat,
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error creating and generating ai_chat: ${errorMessage}`,
    };
  }
}
