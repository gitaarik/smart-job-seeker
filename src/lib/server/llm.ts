/**
 * Generic LLM utilities for chat completions
 * Provider-agnostic interface (currently uses Groq, but can be swapped)
 */

import Groq from "groq-sdk";
import { getEnv } from "$lib/tools/get-env";
import { llmCache } from "./cache/llm-cache";
import { isRetryableError, withRetry } from "./utils/retry";
import { errorTracker } from "./monitoring/error-tracker";
import { config } from "./config";

/**
 * Chat message format for LLM requests
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * JSON schema for structured output
 */
export interface ResponseFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    strict?: boolean;
    schema: Record<string, any>;
  };
}

/**
 * Options for chat completion requests
 */
export interface ChatCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: ResponseFormat;
}

/**
 * Generate a cache key from messages and options
 */
function generateCacheKey(
  messages: ChatMessage[],
  options: ChatCompletionOptions,
): string {
  return JSON.stringify({ messages, options });
}

/**
 * Generate a chat completion using the configured LLM provider
 * Currently uses Groq, but provider-agnostic interface allows easy switching
 *
 * Includes caching and retry logic for reliability
 *
 * @param messages Array of chat messages (system, user, assistant)
 * @param options Optional configuration for the completion
 * @returns The generated text response
 * @throws Error if no content is returned from the LLM
 */
export async function generateChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): Promise<string> {
  const {
    model = "meta-llama/llama-4-scout-17b-16e-instruct",
    maxTokens = 2048,
    temperature = 0.7,
    responseFormat,
  } = options;

  // Check cache first
  const cacheKey = generateCacheKey(messages, options);
  const cachedResponse = llmCache.get(cacheKey, model);

  if (cachedResponse) {
    errorTracker.logDebug("LLM cache hit", {
      operation: "generateChatCompletion",
      metadata: { model },
    });
    return cachedResponse;
  }

  // Initialize client (currently Groq)
  const client = new Groq({
    apiKey: config.groqApiKey || getEnv("GROQ_API_KEY", ""),
  });

  // Make completion request with retry logic
  const content = await withRetry(
    async () => {
      const completion = await client.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        ...(responseFormat && { response_format: responseFormat }),
      });

      const responseContent = completion.choices[0]?.message?.content;

      if (!responseContent) {
        throw new Error("No content returned from LLM");
      }

      return responseContent;
    },
    {
      maxAttempts: config.retryMaxAttempts,
      initialDelay: config.retryInitialDelay,
      maxDelay: config.retryMaxDelay,
      shouldRetry: isRetryableError,
    },
  );

  // Cache the successful response
  llmCache.set(cacheKey, content, model, config.llmCacheTTL);

  errorTracker.logDebug("LLM response generated and cached", {
    operation: "generateChatCompletion",
    metadata: { model, contentLength: content.length },
  });

  return content;
}
