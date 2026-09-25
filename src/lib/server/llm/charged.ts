/**
 * Model calls that charge the tokens they spend to the user they spend them
 * for.
 *
 * Every token a call spends is charged to the user it was spent for (decided
 * 2026-09-25, planning/LANGFUSE.md, change 2). `createAndGenerateAiChat`,
 * `generateAiChatResponse` and the resume parser charge their own; this is for
 * the calls that go straight to the model, which until then charged nobody:
 * auto-translate, the verification-email parser and the scraper's helpers.
 */

import { chargeCredits, tokensToCost } from '$lib/server/billing/credits';
import { estimateProviderCostUsd } from '$lib/server/billing/provider-costs';
import { config } from '$lib/server/config';
import { errorTracker } from '$lib/server/monitoring/error-tracker';
import {
	completionOutput,
	generateChatCompletionTracked,
	type ChatCompletionOptions,
	type ChatMessage,
	type CompletionResult,
	type StructuredOutputConfig
} from './langchain.js';

/**
 * `generateChatCompletion`, with the tokens the call spent charged to `userId`.
 *
 * `userId` null charges nobody: a call made on no user's behalf, such as a dev
 * script or a probe outside a run.
 *
 * The charge is made as soon as the call returns and before its output is
 * parsed, as the resume parser does: the provider bills an answer the caller
 * then rejects exactly like one it keeps. A call that throws charges nothing,
 * as in `createAndGenerateAiChat`, and neither does a response-cache hit, which
 * spent nothing. A charge that fails is logged, never thrown: the work is done
 * by then, and losing it over a ledger write helps nobody.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- as generateChatCompletion
export async function generateChatCompletionCharged<T = any>(
	userId: string | null,
	messages: ChatMessage[],
	options: ChatCompletionOptions & { structuredOutput: StructuredOutputConfig }
): Promise<T>;

export async function generateChatCompletionCharged(
	userId: string | null,
	messages: ChatMessage[],
	options?: ChatCompletionOptions
): Promise<string>;

export async function generateChatCompletionCharged(
	userId: string | null,
	messages: ChatMessage[],
	options: ChatCompletionOptions = {}
): Promise<string> {
	const result = await generateChatCompletionTracked(messages, options);
	if (userId) await chargeCompletion(userId, result, options);
	return completionOutput(result, options);
}

async function chargeCompletion(
	userId: string,
	result: CompletionResult,
	options: ChatCompletionOptions
): Promise<void> {
	const usage = result.usage;
	if (!usage) return;
	const creditsCost = tokensToCost(usage.totalTokens);
	if (creditsCost <= 0) return;

	// Priced as the model that answered: the fallback's, when it ran.
	const ranOn = result.fallbackUsed ?? {
		provider: options.provider || config.llmProvider,
		model: options.model ?? config.llmModel
	};
	const promptKey = options.promptKey ?? 'unknown';
	try {
		await chargeCredits(
			userId,
			creditsCost,
			'ai_generation',
			`${promptKey} (${usage.totalTokens} tokens)`,
			{
				promptKey,
				tokens: usage,
				provider: ranOn.provider,
				model: ranOn.model,
				providerCostUsd: estimateProviderCostUsd(
					ranOn.provider,
					ranOn.model,
					usage.inputTokens,
					usage.outputTokens,
					usage.cachedInputTokens,
					usage.reasoningTokens
				)
			}
		);
	} catch (error) {
		errorTracker.logWarning('Could not charge a model call to its user', {
			operation: 'generateChatCompletionCharged',
			metadata: {
				userId,
				promptKey,
				credits: creditsCost,
				error: error instanceof Error ? error.message : String(error)
			}
		});
	}
}
