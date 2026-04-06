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

interface TokenCost {
  /** Cost per input token in USD */
  input: number;
  /** Cost per output token in USD */
  output: number;
}

/**
 * Provider cost table. Keys are "provider/model".
 * Costs are per-token (divide per-million prices by 1_000_000).
 *
 * Last updated: 2026-04-06
 */
const PROVIDER_COSTS: Record<string, TokenCost> = {
  // Groq — https://groq.com/pricing
  "groq/meta-llama/llama-4-scout-17b-16e-instruct":    { input: 0.11e-6, output: 0.34e-6 },
  "groq/meta-llama/llama-4-maverick-17b-128e-instruct": { input: 0.50e-6, output: 0.77e-6 },
  "groq/llama-3.3-70b-versatile":                       { input: 0.59e-6, output: 0.79e-6 },

  // DeepSeek — https://api-docs.deepseek.com/quick_start/pricing
  // Using cache-miss price for input (worst case). Cache hits are ~10x cheaper.
  "deepseek/deepseek-chat": { input: 0.28e-6, output: 0.42e-6 },

  // OpenAI — https://openai.com/api/pricing/
  "openai/gpt-4o":      { input: 2.50e-6, output: 10.0e-6 },
  "openai/gpt-4o-mini": { input: 0.15e-6, output: 0.60e-6 },

  // Gemini — https://ai.google.dev/gemini-api/docs/pricing
  // Note: gemini-2.0-flash-exp is deprecated June 2026
  "gemini/gemini-2.0-flash-exp": { input: 0.10e-6, output: 0.40e-6 },
  "gemini/gemini-2.0-flash":     { input: 0.10e-6, output: 0.40e-6 },
  "gemini/gemini-2.5-flash":     { input: 0.15e-6, output: 0.60e-6 },

  // Cerebras — https://cerebras.ai/pricing
  // llama-3.3-70b deprecated Feb 2026; keeping for backfill of historical data
  "cerebras/llama-3.3-70b":    { input: 0.60e-6, output: 0.60e-6 },
  "cerebras/llama-3.1-70b":    { input: 0.60e-6, output: 0.60e-6 },
  "cerebras/llama-3.1-8b":     { input: 0.10e-6, output: 0.10e-6 },
};

/**
 * Estimate the USD cost of an LLM API call.
 *
 * Returns null if the provider/model combination is not in the pricing table,
 * which signals that the table needs updating.
 */
export function estimateProviderCostUsd(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const key = `${provider}/${model}`;
  const cost = PROVIDER_COSTS[key];
  if (!cost) return null;
  return inputTokens * cost.input + outputTokens * cost.output;
}

/**
 * Check if a provider/model combination has known pricing.
 * Useful for logging warnings when pricing is missing.
 */
export function hasProviderPricing(provider: string, model: string): boolean {
  return `${provider}/${model}` in PROVIDER_COSTS;
}
