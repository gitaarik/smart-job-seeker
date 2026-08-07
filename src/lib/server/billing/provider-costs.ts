/**
 * LLM provider cost lookup for profitability tracking.
 *
 * Maps provider/model combinations to per-token USD costs.
 * Update this file when pricing changes or new models are added.
 *
 * All costs are in USD per single token (NOT per million).
 * Sources:
 *   - Groq:     https://groq.com/pricing
 *   - DeepSeek: https://api-docs.deepseek.com/quick_start/pricing
 *   - OpenAI:   https://openai.com/api/pricing/
 *   - Gemini:   https://ai.google.dev/gemini-api/docs/pricing
 *   - Cerebras: https://cerebras.ai/pricing
 */

interface TokenRates {
	/** Cost per input token in USD */
	input: number;
	/** Cost per output token in USD */
	output: number;
	/**
	 * Cost per input token served from a cached prefix. Omit where the provider
	 * doesn't discount one — cached tokens then bill at the full `input` rate,
	 * which is the safe direction to be wrong in.
	 */
	cachedInput?: number;
}

interface TokenCost extends TokenRates {
	/**
	 * Rates that REPLACE the ones above once a prompt exceeds `thresholdTokens`.
	 *
	 * Gemini 2.5 Pro doubles every rate past 200k input tokens, and a flat table
	 * would under-report exactly the calls worth knowing about. Our worst
	 * measured assistant turn is ~51k, so this does not bind today — it is here
	 * so that the day something does cross the line, the number moves.
	 */
	longContext?: TokenRates & { thresholdTokens: number };
}

/**
 * Provider cost table. Keys are "provider/model".
 * Costs are per-token (divide per-million prices by 1_000_000).
 *
 * ⚠️ This file is duplicated: cloud's `src/lib/server/billing/` is bind-mounted
 * over the OSS copy at runtime (docker-compose.yml), so the CLOUD one is what
 * actually prices anything deployed. `oss-stub-drift.test.ts` compares the two
 * directories' exported *symbols*, not their contents — it would not notice a
 * rate that had been fixed on one side only. Change both, keep them identical.
 *
 * Last updated: 2026-08-06
 */
const PROVIDER_COSTS: Record<string, TokenCost> = {
	// Groq — https://groq.com/pricing
	'groq/openai/gpt-oss-120b': { input: 0.15e-6, output: 0.6e-6 },
	'groq/openai/gpt-oss-20b': { input: 0.075e-6, output: 0.3e-6 },
	// llama-4-scout decommissioned 2026-07-17; keep for historical backfill
	'groq/meta-llama/llama-4-scout-17b-16e-instruct': { input: 0.11e-6, output: 0.34e-6 },
	'groq/meta-llama/llama-4-maverick-17b-128e-instruct': { input: 0.5e-6, output: 0.77e-6 },
	'groq/llama-3.3-70b-versatile': { input: 0.59e-6, output: 0.79e-6 },

	// DeepSeek — https://api-docs.deepseek.com/quick_start/pricing
	// Using cache-miss price for input (worst case). Cache hits are ~10x cheaper.
	'deepseek/deepseek-chat': { input: 0.28e-6, output: 0.42e-6 },

	// OpenAI — https://openai.com/api/pricing/
	'openai/gpt-4o': { input: 2.5e-6, output: 10.0e-6 },
	'openai/gpt-4o-mini': { input: 0.15e-6, output: 0.6e-6 },

	// Gemini — https://ai.google.dev/gemini-api/docs/pricing
	// Note: gemini-2.0-flash-exp is deprecated June 2026
	'gemini/gemini-2.0-flash-exp': { input: 0.1e-6, output: 0.4e-6 },
	'gemini/gemini-2.0-flash': { input: 0.1e-6, output: 0.4e-6 },
	// Was 0.15/0.60 here, which was never this model's price — checked against
	// the pricing page on 2026-08-06 and corrected. Nothing currently runs on it.
	'gemini/gemini-2.5-flash': { input: 0.3e-6, output: 2.5e-6, cachedInput: 0.03e-6 },
	/**
	 * The writing model — every cover letter, application answer, STAR story,
	 * cheat sheet and assistant turn. It was missing from this table entirely, so
	 * `estimateProviderCostUsd` returned null for all 178 of its charges: the one
	 * model where cost actually matters was the one nobody was measuring.
	 */
	'gemini/gemini-2.5-pro': {
		input: 1.25e-6,
		output: 10.0e-6,
		cachedInput: 0.125e-6,
		longContext: {
			thresholdTokens: 200_000,
			input: 2.5e-6,
			output: 15.0e-6,
			cachedInput: 0.25e-6
		}
	},

	// Cerebras — https://cerebras.ai/pricing
	// llama-3.3-70b deprecated Feb 2026; keeping for backfill of historical data
	'cerebras/llama-3.3-70b': { input: 0.6e-6, output: 0.6e-6 },
	'cerebras/llama-3.1-70b': { input: 0.6e-6, output: 0.6e-6 },
	'cerebras/llama-3.1-8b': { input: 0.1e-6, output: 0.1e-6 }
};

/**
 * Models we've already complained about, so a missing price is one line in the
 * log rather than one per generation.
 */
const warnedMissingPricing = new Set<string>();

/**
 * Estimate the USD cost of an LLM API call.
 *
 * Returns null if the provider/model combination is not in the pricing table,
 * and now says so out loud. The old doc claimed the null "signals that the
 * table needs updating", but nothing received that signal: null was written
 * into the charge metadata and there it sat. `gemini-2.5-pro` went unpriced
 * across every user-facing generation for as long as it had been the writing
 * model, and the only reason anyone noticed was going looking.
 *
 * `cachedInputTokens` is the subset of `inputTokens` the provider served from a
 * cached prefix — NOT an amount to add on top. LangChain reports it as
 * `usage_metadata.input_token_details.cache_read`, and Gemini 2.5 caches
 * implicitly, so it can be non-zero without anyone asking for it. Passing 0 (or
 * omitting it) prices everything at the full rate, which is the pre-existing
 * behaviour and errs high.
 */
export function estimateProviderCostUsd(
	provider: string,
	model: string,
	inputTokens: number,
	outputTokens: number,
	cachedInputTokens = 0
): number | null {
	const key = `${provider}/${model}`;
	const cost = PROVIDER_COSTS[key];
	if (!cost) {
		if (!warnedMissingPricing.has(key)) {
			warnedMissingPricing.add(key);
			console.warn(
				`[billing] No pricing for "${key}" — its generations will record ` +
					`providerCostUsd: null and are invisible to cost tracking. Add it to ` +
					`PROVIDER_COSTS in billing/provider-costs.ts (both copies).`
			);
		}
		return null;
	}

	const rates =
		cost.longContext && inputTokens > cost.longContext.thresholdTokens ? cost.longContext : cost;

	// Clamped because it is a subset: a provider reporting more cached tokens
	// than input tokens would otherwise produce a negative fresh-token count and
	// an under-estimate, which is the one direction this must not fail in.
	const cached = Math.min(Math.max(cachedInputTokens, 0), inputTokens);
	const fresh = inputTokens - cached;

	return (
		fresh * rates.input + cached * (rates.cachedInput ?? rates.input) + outputTokens * rates.output
	);
}

/**
 * Check if a provider/model combination has known pricing.
 * Useful for logging warnings when pricing is missing.
 */
export function hasProviderPricing(provider: string, model: string): boolean {
	return `${provider}/${model}` in PROVIDER_COSTS;
}
