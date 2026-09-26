/**
 * The model wrapper's half of tracing (planning/LANGFUSE.md § Trace model).
 *
 * One span per logical call, named by its prompt key and marked as a cache hit
 * or miss; under it one generation per provider attempt, so retries and the
 * fallback each show. A generation records the model and its parameters, the
 * messages, the output, the usage in Langfuse's four separate buckets and the
 * cost the app bills from, so Langfuse and /admin/costs agree by construction,
 * and it links to the registered version of its template (prompt-registry.ts).
 * A failed attempt is an ERROR generation that keeps the usage its error
 * carried: a provider bills a failed call like a successful one.
 *
 * A call made outside any trace opens one of its own, in the matcher's sample
 * group when it is one of the matcher's prompts. An embedding only joins the
 * trace that is open. With telemetry off each of these is just the call.
 */

import { startActiveObservation, updateActiveObservation } from '@langfuse/tracing';
import { estimateProviderCostUsd } from '$lib/server/billing/provider-costs';
import { isInTrace, isTelemetryEnabled, startTrace } from '$lib/server/monitoring/telemetry';
import {
	resolvePrompt,
	type PromptLink,
	type PromptRef
} from '$lib/server/ai-chat/prompt-registry';
import type { ChatMessage, CompletionResult, TokenUsage } from './langchain';

/** The matcher's calls: the bulk of the volume, so sampled. See telemetry.ts. */
const MATCHER_PROMPTS = new Set(['score_job_match', 'extract_matched_skills']);

/**
 * Trace one logical call. `work` gets a function to call when the answer came
 * from the response cache, which makes the span and no generation.
 */
export async function traceLlmCall<T>(
	promptKey: string | undefined,
	work: (markCacheHit: () => void) => Promise<T>
): Promise<T> {
	if (!isTelemetryEnabled()) return work(() => {});

	const name = promptKey ?? 'llm call';
	const body = async () => {
		let cache = 'miss';
		try {
			return await work(() => {
				cache = 'hit';
			});
		} finally {
			updateActiveObservation({ metadata: { cache } });
		}
	};
	return isInTrace()
		? startActiveObservation(name, body)
		: startTrace({ name, sampleGroup: MATCHER_PROMPTS.has(name) ? 'matcher' : 'default' }, body);
}

export interface Attempt {
	provider: string;
	model: string;
	messages: ChatMessage[];
	temperature: number;
	maxTokens: number;
	structured: boolean;
	/** The template the call rendered, whose registered version it links to. */
	prompt?: PromptRef | null;
}

/**
 * Trace one provider attempt as a generation, linked to the registered version
 * of its template. The version is looked up while the model runs.
 */
export async function traceAttempt(
	attempt: Attempt,
	call: () => Promise<CompletionResult>
): Promise<CompletionResult> {
	if (!isTelemetryEnabled()) return call();

	const link = attempt.prompt ? resolvePrompt(attempt.prompt) : null;
	return startActiveObservation(
		attempt.provider,
		async (generation) => {
			generation.update({
				model: attempt.model,
				modelParameters: {
					provider: attempt.provider,
					temperature: attempt.temperature,
					maxTokens: attempt.maxTokens,
					responseFormat: attempt.structured ? 'json' : 'text'
				},
				input: attempt.messages
			});
			try {
				const result = await call();
				generation.update({
					output: result.content,
					...usageAndCost(attempt, result.usage),
					...(await promptAttributes(attempt.prompt, link))
				});
				// Only a generation Langfuse will receive is worth pointing at.
				return generation.otelSpan.isRecording()
					? { ...result, observationId: generation.id }
					: result;
			} catch (error) {
				generation.update({
					level: 'ERROR',
					statusMessage: error instanceof Error ? error.message : String(error),
					...usageAndCost(attempt, (error as { usage?: TokenUsage } | null)?.usage ?? null),
					...(await promptAttributes(attempt.prompt, link))
				});
				throw error;
			}
		},
		{ asType: 'generation' }
	);
}

/** How long an ended attempt waits for its template's version before going unlinked. */
const PROMPT_LINK_WAIT_MS = 1000;

/**
 * The generation's link to its template's version, which has to be on it before
 * it ends: Langfuse resolves the link once, at ingestion, and never again. The
 * lookup started with the model call, so it has almost always finished; one
 * that has not in time leaves only the fingerprint, which every generation of a
 * template carries.
 */
async function promptAttributes(
	prompt: PromptRef | null | undefined,
	link: Promise<PromptLink | null> | null
) {
	if (!prompt || !link) return {};
	const version = await withDeadline(link, PROMPT_LINK_WAIT_MS);
	return {
		metadata: { prompt_fingerprint: prompt.fingerprint },
		...(version ? { prompt: { ...version, isFallback: false } } : {})
	};
}

async function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T | null> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<null>((resolve) => {
		timer = setTimeout(() => resolve(null), ms);
	});
	try {
		return await Promise.race([promise, deadline]);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Record the messages an attempt sent, in place of the ones it was given, when
 * a provider path rewrites them: the JSON reminder added for Groq and Cerebras.
 */
export function recordSentMessages(messages: ChatMessage[]): void {
	if (!isTelemetryEnabled() || !isInTrace()) return;
	updateActiveObservation({ input: messages }, { asType: 'generation' });
}

/**
 * Trace an embedding call as an `embedding` observation, named by its provider,
 * inside the trace that is open. Outside one it is only the call: an embedding
 * is a step of some unit of work, never a unit of its own. The input is its
 * size, since the text is already in the step that asked for it.
 */
export async function traceEmbedding<T extends number[] | number[][]>(
	provider: string,
	model: string,
	texts: string[],
	call: () => Promise<T>
): Promise<T> {
	if (!isTelemetryEnabled() || !isInTrace()) return call();

	return startActiveObservation(
		provider,
		async (embedding) => {
			embedding.update({
				model,
				input: { texts: texts.length, chars: texts.reduce((sum, text) => sum + text.length, 0) }
			});
			try {
				return await call();
			} catch (error) {
				embedding.update({
					level: 'ERROR',
					statusMessage: error instanceof Error ? error.message : String(error)
				});
				throw error;
			}
		},
		{ asType: 'embedding' }
	);
}

/**
 * Langfuse counts its buckets separately. Cached input is part of the provider's
 * input count and reasoning is not part of its output count (TokenUsage), so
 * the cached share comes off the input and reasoning is its own bucket.
 */
function usageAndCost(attempt: Attempt, usage: TokenUsage | null) {
	if (!usage) return {};
	const cached = usage.cachedInputTokens ?? 0;
	const reasoning = usage.reasoningTokens ?? 0;
	return {
		usageDetails: {
			input: usage.inputTokens - cached,
			input_cached_tokens: cached,
			output: usage.outputTokens,
			output_reasoning_tokens: reasoning
		},
		costDetails: {
			total:
				estimateProviderCostUsd(
					attempt.provider,
					attempt.model,
					usage.inputTokens,
					usage.outputTokens,
					cached,
					reasoning
				) ?? 0
		}
	};
}
