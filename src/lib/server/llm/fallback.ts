/**
 * Which second provider each class of call is allowed to fall back to.
 *
 * The POLICY lives here; the MECHANISM is `ChatCompletionOptions.fallback` in
 * langchain.ts, which applies whatever it is handed and decides nothing. Kept
 * apart on purpose: "is a different model's output interchangeable with this
 * one's" is a question about the call, and answering it inside the generator
 * would silently extend failover to every caller that ever passes through it.
 *
 * Two classes, because they fail for different reasons and want different
 * answers:
 *
 *  - **Writing** wants a second model that is at least as good. A person is
 *    waiting on the answer, reads it, and can regenerate it, so a different
 *    voice is an acceptable substitute for an error toast.
 *  - **Extraction** wants a second model that is CHEAP and structurally
 *    compatible. Nobody reads its prose; what matters is that a scrape which
 *    already spent minutes of browser time is not thrown away over one 429.
 *
 * ## The compatibility constraint on extraction targets
 *
 * `generateWithLangChain` sends only `groq` and `cerebras` down the JSON-mode
 * path; everything else goes through `withStructuredOutput`, which converts the
 * Zod schema to JSON Schema and throws on `extract_job_data`'s salary
 * `.transform()`s ("Transforms cannot be represented in JSON Schema"). So an
 * extraction fallback on any other provider today trades a rate limit for a
 * hard schema error on the single most important extraction prompt.
 *
 * That is why there is no default target: `cerebras` is the only compatible
 * one, and the account behind SJS_LLM_API_KEY_CEREBRAS answers "payment
 * required" (checked 2026-09-19). A fallback pointing at an unfunded provider
 * is worse than none — it spends a round trip to arrive at the same error.
 * Config resolves both pairs to empty unless told otherwise; see config.ts.
 *
 * Unblocking it is two small pieces of work, in either order: move
 * `extract_job_data`'s rounding caller-side so the schema survives JSON-Schema
 * conversion (which opens up every provider), or add the other
 * OpenAI-compatible providers to the JSON-mode branch (which opens up the cheap
 * ones). Either way the target also needs a row in PROVIDER_COSTS, in both
 * copies of that file, or its calls price as null.
 */
import { config } from '$lib/server/config';

export interface FallbackTarget {
	provider: string;
	model: string;
}

function pairOrNone(provider: string, model: string): FallbackTarget | undefined {
	return provider && model ? { provider, model } : undefined;
}

/**
 * Failover target for user-facing writing, or undefined when it is off.
 *
 * Used by both writing entry points — `createAndGenerateAiChat` and the
 * regeneration path in `response-generate.ts` — because a fallback the
 * assistant chat gets and "regenerate" does not is a split that would only
 * surface during the incident it was built for.
 */
export function writingFallback(): FallbackTarget | undefined {
	return pairOrNone(config.llmWritingFallbackProvider, config.llmWritingFallbackModel);
}

/**
 * Failover target for extraction and scraping, or undefined when it is off,
 * which is the default. See the compatibility note above before enabling it.
 */
export function extractionFallback(): FallbackTarget | undefined {
	return pairOrNone(config.llmFallbackProvider, config.llmFallbackModel);
}
