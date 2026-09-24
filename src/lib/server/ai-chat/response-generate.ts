/**
 * AI Chat response generation using LLM provider
 * Handles generating responses for AI chats using the generic LLM interface
 */

import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { ai_chats, profiles } from '$lib/server/db/schema';
import { config } from '$lib/server/config';
import { getInterpolatedPrompts } from './utils';
import {
	generateChatCompletionTracked,
	LLMAuthenticationError,
	LLMQuotaExceededError,
	LLMRateLimitError,
	writingFallback
} from '$lib/server/llm';
import { getErrorMessage } from '$lib/server/utils/errors';
import { tokensToCost, chargeCredits } from '$lib/server/billing/credits';
import { estimateProviderCostUsd } from '$lib/server/billing/provider-costs';

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
				message: `AI chat with ID ${aiChatId} not found`
			};
		}

		// User-facing writing runs on the writing provider/model (may be a stronger
		// model than the extraction pipeline).
		const writingProvider = config.llmWritingProvider;
		const writingModel = config.llmWritingModel;

		// Generate response using generic LLM function with token tracking
		const completionResult = await generateChatCompletionTracked(
			[
				{ role: 'system', content: prompts.systemPrompt },
				{ role: 'user', content: prompts.userPrompt }
			],
			{
				provider: writingProvider,
				model: writingModel,
				fallback: writingFallback(),
				promptKey: prompts.promptKey ?? undefined
			}
		);

		const usage = completionResult.usage;
		const creditsCost = usage ? tokensToCost(usage.totalTokens) : 0;

		// Which pair actually answered — the fallback when the primary failed over.
		// Written back to the row for the same reason as in createAndGenerateAiChat:
		// the stamp predates the call, and the cost page prices by these columns.
		const ranOn = completionResult.fallbackUsed ?? {
			provider: writingProvider,
			model: writingModel
		};

		// Update the response field + token usage
		await db
			.update(ai_chats)
			.set({
				response: completionResult.content,
				provider: ranOn.provider,
				model: ranOn.model,
				input_tokens: usage?.inputTokens ?? null,
				output_tokens: usage?.outputTokens ?? null,
				total_tokens: usage?.totalTokens ?? null,
				cached_input_tokens: usage?.cachedInputTokens ?? null,
				credits_charged: creditsCost || null
			})
			.where(eq(ai_chats.id, aiChatId));

		// Charge credits
		if (usage && creditsCost > 0) {
			const aiChat = await db.query.ai_chats.findFirst({
				where: eq(ai_chats.id, aiChatId),
				columns: { profile_id: true }
			});
			if (aiChat) {
				const profile = await db.query.profiles.findFirst({
					where: eq(profiles.id, aiChat.profile_id),
					columns: { user_id: true }
				});
				if (profile?.user_id) {
					const providerCostUsd = estimateProviderCostUsd(
						ranOn.provider,
						ranOn.model,
						usage.inputTokens,
						usage.outputTokens,
						usage.cachedInputTokens
					);
					await chargeCredits(
						profile.user_id,
						creditsCost,
						'ai_generation',
						`regenerate (${usage.totalTokens} tokens)`,
						{
							aiChatId,
							tokens: usage,
							provider: ranOn.provider,
							model: ranOn.model,
							providerCostUsd
						}
					);
				}
			}
		}

		return {
			success: true,
			message: `Response generated for AI chat ID ${aiChatId}`
		};
	} catch (error) {
		// Provide specific error messages for LLM errors
		if (error instanceof LLMQuotaExceededError) {
			return {
				success: false,
				message: `${error.message}. Please add more credits or switch providers.`
			};
		}

		if (error instanceof LLMAuthenticationError) {
			return {
				success: false,
				message: `${error.message}. Please check your API key configuration.`
			};
		}

		if (error instanceof LLMRateLimitError) {
			return {
				success: false,
				message: `${error.message}. Please try again later.`
			};
		}

		// Generic error handling
		return {
			success: false,
			message: `Error generating response: ${getErrorMessage(error)}`
		};
	}
}
