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
} from "./llm-langchain";
