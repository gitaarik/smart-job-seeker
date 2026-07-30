/**
 * Shared utilities for AI chat prompt handling
 */

import { db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { ai_chats, collected_data, profiles } from "$lib/server/db/schema";
import { config } from "$lib/server/config";
import {
  generateChatCompletionTracked,
  isFatalLLMError,
} from "$lib/server/llm";
import { getSchemaForPrompt } from "$lib/server/schemas/ai-prompt-schemas";
import { promptTemplates } from "./prompt-templates.js";
import { tokensToCost } from "$lib/server/billing/credits";
import { estimateProviderCostUsd } from "$lib/server/billing/provider-costs";
import { exportProfile } from "$lib/server/profile/export";

/**
 * User-facing writing prompts run on the writing provider/model
 * (config.llmWriting*), typically a stronger/paid model (Gemini) chosen for
 * prose quality. Everything else — extraction, scraping helpers, matching —
 * runs on the app provider/model (config.llmProvider/llmModel), which the
 * structured, transform-bearing schemas are tuned for (Groq gpt-oss).
 *
 * Gemini's structured-output mode rejects field-level Zod `.transform()`s
 * (e.g. extract_job_data's salary coercion → "Transforms cannot be represented
 * in JSON Schema"), so extraction MUST stay on the app provider. Any NEW
 * user-facing writing prompt must be added here; everything else defaults to
 * the extraction provider.
 */
const WRITING_PROMPT_KEYS = new Set<string>([
  "personal_agent_chat",
  "write_cover_letter",
  "advise_cover_letter",
  "review_cover_letter",
  "write_cheat_sheet",
  "advise_cheat_sheet",
  "review_cheat_sheet",
  "answer_application_question",
  "advise_application_question",
  "review_application_question",
  "revise_application_question",
  "followup_application_question",
  "write_star_story",
  "advise_star_story",
  "review_star_story",
  "followup_star_story",
  "followup",
  "followup_letter",
]);

/**
 * Format the applicant's own free-text brief for a prompt's
 * `${additionalContext}` slot — what they typed in the editor's composer
 * before asking for advice or a draft.
 *
 * Returns "" when blank so the slot collapses to nothing (the no-brief case is
 * the common one, and an empty header would read as a missing instruction).
 * When present it gets a header, so the model reads it as the applicant
 * speaking rather than as a continuation of the job or profile data above it,
 * and an explicit note that it does not override the output format — a brief
 * like "just give me bullet points" must not break a structured-JSON contract.
 */
export function instructionsBlock(text?: string | null): string {
  const trimmed = text?.trim();
  if (!trimmed) return "";
  return `## What the applicant asked for

Follow this as far as it makes sense. It does NOT override the output format required above.

${trimmed}`;
}

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
  const aiChat = await db.query.ai_chats.findFirst({
    where: eq(ai_chats.id, aiChatId),
    columns: { system_prompt: true, user_prompt: true, profile_id: true },
  });

  if (!aiChat) {
    return null;
  }

  // Fetch the collected_data for this profile
  const collectedDataRecord = await db.query.collected_data.findFirst({
    where: eq(collected_data.profile_id, aiChat.profile_id),
    columns: { schema: true, data: true },
  });

  // Prepare replacements (use empty objects as defaults)
  const variables = {
    schema: collectedDataRecord?.schema || "{}",
    data: collectedDataRecord?.data || "{}",
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
  options?: {
    /** Top-level profile data keys to include. If omitted, all data is included. */
    profileDataFields?: string[];
  },
): Promise<{
  success: boolean;
  message: string;
  aiChat?: {
    id: number;
    profile_id: number;
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
    // Check credits before doing any work
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.id, profileId),
      columns: { user_id: true },
    });
    if (profile?.user_id) {
      const { getBalance } = await import("$lib/server/billing/credits");
      const balance = await getBalance(profile.user_id);
      if (balance.available <= 0) {
        return {
          success: false,
          message:
            "Out of credits. Please upgrade your plan or buy extra credits.",
        };
      }
    }

    // Step 1: Get prompt template from code
    const promptTemplate = fetchPromptTemplate(promptKey);

    if (!promptTemplate) {
      return {
        success: false,
        message:
          `AI prompt template not found for key: '${promptKey}'. Please ensure it exists in prompt-templates.ts.`,
      };
    }

    // Step 2: Fetch collected_data for the profile. Manually-created profiles
    // don't have a record until something explicitly calls exportProfile, so
    // backfill on first use here — better than every AI feature getting `{}`
    // and silently hallucinating.
    let collectedDataRecord = await db.query.collected_data.findFirst({
      where: eq(collected_data.profile_id, profileId),
      columns: { schema: true, data: true },
    });

    if (!collectedDataRecord) {
      await exportProfile(profileId);
      collectedDataRecord = await db.query.collected_data.findFirst({
        where: eq(collected_data.profile_id, profileId),
        columns: { schema: true, data: true },
      });
    }

    // Step 3: Parse schema and data from JSON strings to objects
    // These will be stored as raw JSON in context, but stringified for interpolation
    let schemaJson = collectedDataRecord?.schema
      ? JSON.parse(collectedDataRecord.schema)
      : {};
    let dataJson = collectedDataRecord?.data
      ? JSON.parse(collectedDataRecord.data)
      : {};

    // Step 3b: Filter to requested profile data fields if specified
    const profileDataFields = options?.profileDataFields;
    if (profileDataFields) {
      if (profileDataFields.length === 0) {
        // Empty array = include no profile data
        dataJson = {};
        schemaJson = {};
      } else {
        const fieldSet = new Set(profileDataFields);

        // Filter data: keep only requested top-level keys
        const filteredData: Record<string, unknown> = {};
        for (const key of profileDataFields) {
          if (key in dataJson) {
            filteredData[key] = dataJson[key];
          }
        }
        dataJson = filteredData;

        // Filter schema: keep only matching fields and relations
        if (schemaJson.fields || schemaJson.relations) {
          const filteredSchema: Record<string, unknown> = { ...schemaJson };
          if (schemaJson.fields) {
            filteredSchema.fields = Object.fromEntries(
              Object.entries(schemaJson.fields).filter(([k]) =>
                fieldSet.has(k)
              ),
            );
          }
          if (schemaJson.relations) {
            filteredSchema.relations = Object.fromEntries(
              Object.entries(schemaJson.relations).filter(([k]) =>
                fieldSet.has(k)
              ),
            );
          }
          schemaJson = filteredSchema;
        }
      }
    }

    // Step 4: Prepare context (raw variables as JSON objects)
    const context = {
      schema: schemaJson,
      data: dataJson,
      ...(customVariables || {}),
    } as Record<string, unknown>;

    // Step 5: Prepare variables for interpolation (stringified for prompts)
    const interpolationVariables: Record<string, string> = {
      schema: JSON.stringify(schemaJson, null, 2),
      data: JSON.stringify(dataJson, null, 2),
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

    // Resolve provider/model by prompt type: user-facing writing runs on the
    // writing provider/model, everything else on the app (extraction) provider.
    // Used for the record stamp, generation, and cost accounting alike.
    const isWritingPrompt = WRITING_PROMPT_KEYS.has(promptKey);
    const activeProvider = isWritingPrompt
      ? config.llmWritingProvider
      : config.llmProvider;
    const activeModel = isWritingPrompt
      ? config.llmWritingModel
      : config.llmModel;

    // Step 7: Create the ai_chats record with template prompts (not interpolated)
    const [aiChat] = await db.insert(ai_chats).values({
      profile_id: profileId,
      system_prompt: promptTemplate.system_prompt,
      user_prompt: promptTemplate.user_prompt,
      context: JSON.parse(JSON.stringify(context)),
      followup_to: followupTo,
      date_created: new Date(),
      provider: activeProvider,
      model: activeModel,
      request_type: "llm",
    }).returning();
    aiChatId = aiChat.id;

    // Step 6: Generate and save full_prompt (interpolated combination)
    const fullPrompt = makeFullPrompt(
      interpolatedSystemPrompt,
      interpolatedUserPrompt,
    );

    await db.update(ai_chats).set({ full_prompt: fullPrompt })
      .where(eq(ai_chats.id, aiChat.id));

    // Step 7: Generate AI response using generic LLM function
    // Look up Zod schema from code registry (no longer using database format field)
    const zodSchema = getSchemaForPrompt(promptKey);
    const structuredOutput = zodSchema
      ? {
        name: promptKey.replace(/[^a-zA-Z0-9_]/g, "_"),
        schema: zodSchema,
      }
      : undefined;

    const completionResult = await generateChatCompletionTracked(
      [
        { role: "system", content: interpolatedSystemPrompt },
        { role: "user", content: interpolatedUserPrompt },
      ],
      { structuredOutput, provider: activeProvider, model: activeModel },
    );

    // Step 8: Save response + token usage
    const responseContent = completionResult.content;
    const responseToSave = structuredOutput
      ? (() => {
        try {
          return JSON.stringify(JSON.parse(responseContent));
        } catch {
          return responseContent;
        }
      })()
      : responseContent;

    const usage = completionResult.usage;
    const creditsCost = usage ? tokensToCost(usage.totalTokens) : 0;

    await db.update(ai_chats).set({
      response: responseToSave,
      input_tokens: usage?.inputTokens ?? null,
      output_tokens: usage?.outputTokens ?? null,
      total_tokens: usage?.totalTokens ?? null,
      credits_charged: creditsCost || null,
    }).where(eq(ai_chats.id, aiChat.id));

    // Charge credits if we have a user and usage
    if (usage && creditsCost > 0) {
      const profileForCredits = await db.query.profiles.findFirst({
        where: eq(profiles.id, profileId),
        columns: { user_id: true },
      });
      if (profileForCredits?.user_id) {
        const { chargeCredits } = await import("$lib/server/billing/credits");
        const providerCostUsd = estimateProviderCostUsd(
          activeProvider,
          activeModel,
          usage.inputTokens,
          usage.outputTokens,
        );
        await chargeCredits(
          profileForCredits.user_id,
          creditsCost,
          "ai_generation",
          `${promptKey} (${usage.totalTokens} tokens)`,
          {
            aiChatId: aiChat.id,
            promptKey,
            tokens: usage,
            provider: activeProvider,
            model: activeModel,
            providerCostUsd,
          },
        );
      }
    }

    // Step 9: Fetch and return the complete ai_chats record
    const completeAiChat = await db.query.ai_chats.findFirst({
      where: eq(ai_chats.id, aiChat.id),
      columns: {
        id: true,
        profile_id: true,
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
      await db.update(ai_chats).set({ error: errorMessage })
        .where(eq(ai_chats.id, aiChatId));
      console.error(
        `      📋 Error details: ai_chat ID ${aiChatId}`,
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
