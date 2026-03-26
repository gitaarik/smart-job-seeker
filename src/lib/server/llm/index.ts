/**
 * LLM utilities for chat completions
 * This file re-exports the LangChain-based implementation for backward compatibility
 */

// Explicit import for local use in isFatalLLMError (re-exports don't create
// local bindings in ESM, which causes ReferenceError at runtime with tsx/esbuild)
import {
  LLMAuthenticationError,
  LLMQuotaExceededError,
  LLMRateLimitError,
} from "./langchain.js";

export {
  type ChatCompletionOptions,
  type ChatMessage,
  generateChatCompletion,
  LLMAuthenticationError,
  LLMError,
  LLMQuotaExceededError,
  LLMRateLimitError,
  type StructuredOutputConfig,
} from "./langchain.js";

export { llmCache } from "./cache.js";

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
