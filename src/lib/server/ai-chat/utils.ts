/**
 * Shared utilities for AI chat prompt handling
 */

import { db } from "$lib/server/db";
import { config } from "$lib/server/config";
import {
  generateChatCompletion,
  isFatalLLMError,
} from "$lib/server/llm";
import { getSchemaForPrompt } from "$lib/server/schemas/ai-prompt-schemas";
import { promptTemplates } from "./prompt-templates.js";

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
    // Support both ${variable} and {{variable}} syntax
    const dollarRegex = new RegExp(`\\$\\{${key}\\}`, "g");
    const mustacheRegex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(dollarRegex, value);
    result = result.replace(mustacheRegex, value);
  }
  return result;
}

/**
 * Combine system and user prompts into a full prompt with distinctive headers
 * Uses special separators that won't conflict with typical markdown sections
 */
export function makeFullPrompt(
  systemPrompt: string,
  userPrompt: string,
): string {
  return `----------------

# SYSTEM PROMPT:

----------------

${systemPrompt}


----------------

# USER PROMPT:

----------------

${userPrompt}`;
}

/**
 * Get prompt template by key identifier.
 * Reads from code-defined templates (prompt-templates.ts).
 */
function fetchPromptTemplate(
  key: string,
): {
  id: number;
  system_prompt: string;
  user_prompt: string;
  format: string | null;
} | null {
  const template = promptTemplates[key];

  if (!template?.system_prompt || !template?.user_prompt) {
    return null;
  }

  return {
    id: 0, // Not used for code-defined templates
    system_prompt: template.system_prompt,
    user_prompt: template.user_prompt,
    format: null,
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
  // Fetch the ai_chatss record
  const aiChat = await db.ai_chats.findUnique({
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
 * Create and fully generate an AI chat instance using prompt templates from ai_chat_templates
 * Orchestrates the entire process:
 * 1. Fetches prompt template from ai_chat_templates by key identifier
 * 2. Fetches collected_data for the profile to get schema and data
 * 3. Merges standard variables (schema, data) with custom variables
 * 4. Interpolates prompts with all variables (stringifying JSON as needed)
 * 5. Creates ai_chats record with template prompts and original context values
 * 6. Saves interpolated full_prompt
 * 7. Generates response via Groq API with interpolated prompts
 * 8. Returns the complete ai_chats record
 *
 * @param profileId - The profile ID for this AI chat
 * @param promptKey - The unique key identifier from ai_chat_templates table
 * @param customVariables - Optional custom variables (strings or objects) for interpolation and context
 * @param followupTo - Optional parent ai_chats ID if this is a follow-up
 * @returns Object with success status, message, and the created ai_chats record (if successful)
 */
export async function createAndGenerateAiChat(
  profileId: number,
  promptKey: string,
  customVariables?: Record<string, unknown>,
  followupTo?: number,
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
  // Track aiChat ID so we can save errors to the record if creation succeeds but generation fails
  let aiChatId: number | undefined;

  try {
    // Step 1: Get prompt template from code
    const promptTemplate = fetchPromptTemplate(promptKey);

    if (!promptTemplate) {
      return {
        success: false,
        message:
          `AI prompt template not found for key: '${promptKey}'. Please ensure it exists in prompt-templates.ts.`,
      };
    }

    // Step 2: Fetch collected_data for the profile
    const collectedData = await db.collected_data.findFirst({
      where: { profile: profileId },
      select: { schema: true, data: true },
    });

    // Step 3: Parse schema and data from JSON strings to objects
    // These will be stored as raw JSON in context, but stringified for interpolation
    const schemaJson = collectedData?.schema
      ? JSON.parse(collectedData.schema)
      : {};
    const dataJson = collectedData?.data ? JSON.parse(collectedData.data) : {};

    // Step 4: Prepare context (raw variables as JSON objects)
    const context = {
      schema: schemaJson,
      data: dataJson,
      ...(customVariables || {}),
    } as Record<string, unknown>;

    // Step 5: Prepare variables for interpolation (stringified for prompts)
    const interpolationVariables: Record<string, string> = {
      schema: collectedData?.schema || "{}",
      data: collectedData?.data || "{}",
      ...(customVariables
        ? Object.fromEntries(
          Object.entries(customVariables).map(([key, value]) => [
            key,
            typeof value === "string" ? value : JSON.stringify(value, null, 2),
          ]),
        )
        : {}),
    };

    // Step 6: Interpolate both prompts with stringified variables
    const interpolatedSystemPrompt = interpolatePrompt(
      promptTemplate.system_prompt,
      interpolationVariables,
    );
    const interpolatedUserPrompt = interpolatePrompt(
      promptTemplate.user_prompt,
      interpolationVariables,
    );

    // Step 7: Create the ai_chats record with template prompts (not interpolated)
    const aiChat = await db.ai_chats.create({
      data: {
        profile: profileId,
        system_prompt: promptTemplate.system_prompt,
        user_prompt: promptTemplate.user_prompt,
        context: JSON.parse(JSON.stringify(context)),
        followup_to: followupTo,
        date_created: new Date(),
        provider: config.llmProvider,
        model: config.llmModel,
        request_type: "llm",
      },
    });
    aiChatId = aiChat.id;

    // Step 6: Generate and save full_prompt (interpolated combination)
    const fullPrompt = makeFullPrompt(
      interpolatedSystemPrompt,
      interpolatedUserPrompt,
    );

    await db.ai_chats.update({
      where: { id: aiChat.id },
      data: { full_prompt: fullPrompt },
    });

    // Step 7: Generate AI response using generic LLM function
    // Look up Zod schema from code registry (no longer using database format field)
    const zodSchema = getSchemaForPrompt(promptKey);
    const structuredOutput = zodSchema
      ? {
        name: promptKey.replace(/[^a-zA-Z0-9_]/g, "_"),
        schema: zodSchema,
      }
      : undefined;

    const responseContent = await generateChatCompletion(
      [
        { role: "system", content: interpolatedSystemPrompt },
        { role: "user", content: interpolatedUserPrompt },
      ],
      { structuredOutput },
    );

    // Step 8: Save response (stringify if it's an object from JSON parsing)
    const responseToSave = typeof responseContent === "string"
      ? responseContent
      : JSON.stringify(responseContent);

    await db.ai_chats.update({
      where: { id: aiChat.id },
      data: { response: responseToSave },
    });

    // Step 9: Fetch and return the complete ai_chats record
    const completeAiChat = await db.ai_chats.findUnique({
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
          `Failed to retrieve created ai_chats record with ID ${aiChat.id}`,
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

    // Save error to ai_chats record if it was created
    if (aiChatId) {
      await db.ai_chats.update({
        where: { id: aiChatId },
        data: { error: errorMessage },
      });
      console.error(
        `      📋 Error details: ${config.directusUrl}/admin/content/ai_chats/${aiChatId}`,
      );
    }

    // Re-throw fatal LLM errors so they can abort scraping
    if (isFatalLLMError(error)) {
      throw error;
    }

    return {
      success: false,
      message: `Error creating and generating ai_chats: ${errorMessage}`,
    };
  }
}
