/**
 * LLM utilities for chat completions
 * This file re-exports the LangChain-based implementation for backward compatibility
 */

// Explicit import for local use in isFatalLLMError (re-exports don't create
// local bindings in ESM, which causes ReferenceError at runtime with tsx/esbuild)
import { LLMAuthenticationError, LLMQuotaExceededError, LLMRateLimitError } from './langchain.js';

export {
	type ChatCompletionOptions,
	type ChatMessage,
	type CompletionResult,
	generateChatCompletion,
	generateChatCompletionTracked,
	isLLMOutputValidationMessage,
	LLM_OUTPUT_VALIDATION_PATTERNS,
	LLMAuthenticationError,
	LLMError,
	LLMOutputValidationError,
	LLMQuotaExceededError,
	LLMRateLimitError,
	type StructuredOutputConfig,
	type TokenUsage
} from './langchain.js';

export { llmCache } from './cache.js';

export { cosineSimilarity, embed, embedBatch, isEmbeddingConfigured } from './embeddings.js';

// Re-export zod so worker code in `cloud/` shares the same module identity
// as langchain.ts when building structured-output schemas. Importing zod
// directly from `cloud/` would resolve to a different node_modules tree,
// producing "Two different types with this name exist" errors.
export { z } from 'zod';

/**
 * Check if an error is a fatal LLM error that should stop processing.
 * Fatal errors: quota exceeded, authentication failure, rate limiting.
 */
export function isFatalLLMError(error: unknown): boolean {
	return (
		error instanceof LLMRateLimitError ||
		error instanceof LLMQuotaExceededError ||
		error instanceof LLMAuthenticationError
	);
}
