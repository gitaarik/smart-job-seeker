/**
 * AI Chat response generation using LLM provider
 * Handles generating responses for AI chats using the generic LLM interface
 */

import { db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { ai_chats, profiles } from "$lib/server/db/schema";
import { config } from "$lib/server/config";
import { getInterpolatedPrompts } from "./utils";
import {
  generateChatCompletionTracked,
  LLMAuthenticationError,
  LLMQuotaExceededError,
  LLMRateLimitError,
} from "$lib/server/llm";
import { getErrorMessage } from "$lib/server/utils/errors";
import { tokensToCost, chargeCredits } from "$lib/server/billing/credits";
import { estimateProviderCostUsd } from "$lib/server/billing/provider-costs";

/**
 * Generate response for a single AI chat using LLM provider
 * Feeds system_prompt and user_prompt separately with variable interpolation
 */
export async function generateAiChatResponse(aiChatId: number): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Get interpolated prompts with variables replaced
    const prompts = await getInterpolatedPrompts(aiChatId);

    if (!prompts) {
      return {
        success: false,
        message: `AI chat with ID ${aiChatId} not found`,
      };
    }

    // Generate response using generic LLM function with token tracking
    const completionResult = await generateChatCompletionTracked([
      { role: "system", content: prompts.systemPrompt },
      { role: "user", content: prompts.userPrompt },
    ]);

    const usage = completionResult.usage;
    const creditsCost = usage ? tokensToCost(usage.totalTokens) : 0;

    // Update the response field + token usage
    await db.update(ai_chats).set({
      response: completionResult.content,
      input_tokens: usage?.inputTokens ?? null,
      output_tokens: usage?.outputTokens ?? null,
      total_tokens: usage?.totalTokens ?? null,
      credits_charged: creditsCost || null,
    }).where(eq(ai_chats.id, aiChatId));

    // Charge credits
    if (usage && creditsCost > 0) {
      const aiChat = await db.query.ai_chats.findFirst({
        where: eq(ai_chats.id, aiChatId),
        columns: { profile_id: true },
      });
      if (aiChat) {
        const profile = await db.query.profiles.findFirst({
          where: eq(profiles.id, aiChat.profile_id),
          columns: { user_id: true },
        });
        if (profile?.user_id) {
          const providerCostUsd = estimateProviderCostUsd(
            config.llmProvider, config.llmModel,
            usage.inputTokens, usage.outputTokens,
          );
          await chargeCredits(
            profile.user_id,
            creditsCost,
            "ai_generation",
            `regenerate (${usage.totalTokens} tokens)`,
            {
              aiChatId, tokens: usage,
              provider: config.llmProvider, model: config.llmModel,
              providerCostUsd,
            },
          );
        }
      }
    }

    return {
      success: true,
      message: `Response generated for AI chat ID ${aiChatId}`,
    };
  } catch (error) {
    // Provide specific error messages for LLM errors
    if (error instanceof LLMQuotaExceededError) {
      return {
        success: false,
        message:
          `${error.message}. Please add more credits or switch providers.`,
      };
    }

    if (error instanceof LLMAuthenticationError) {
      return {
        success: false,
        message: `${error.message}. Please check your API key configuration.`,
      };
    }

    if (error instanceof LLMRateLimitError) {
      return {
        success: false,
        message: `${error.message}. Please try again later.`,
      };
    }

    // Generic error handling
    return {
      success: false,
      message: `Error generating response: ${getErrorMessage(error)}`,
    };
  }
}
