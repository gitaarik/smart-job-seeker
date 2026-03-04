/**
 * LLM utilities for chat completions
 * This file re-exports the LangChain-based implementation for backward compatibility
 */

export {
  type ChatCompletionOptions,
  type ChatMessage,
  generateChatCompletion,
  LLMAuthenticationError,
  LLMError,
  LLMQuotaExceededError,
  LLMRateLimitError,
  type StructuredOutputConfig,
} from "./langchain";

export { llmCache } from "./cache";

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
