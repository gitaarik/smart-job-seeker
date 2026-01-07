/**
 * LangChain-based LLM utilities for chat completions
 * Supports multiple providers: Groq, Gemini (Google Generative AI), OpenAI, OpenRouter, and DeepSeek
 */

import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  type BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { z } from "zod";
import { getEnv } from "$lib/tools/get-env";
import { llmCache } from "./cache/llm-cache";
import { isRetryableError, withRetry } from "./utils/retry";
import { errorTracker } from "./monitoring/error-tracker";
import { config } from "./config";

/**
 * Base class for LLM errors
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly model: string,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

/**
 * Thrown when API quota/balance is insufficient
 * This is a permanent error - scraping should stop immediately
 */
export class LLMQuotaExceededError extends LLMError {
  constructor(message: string, provider: string, model: string) {
    super(message, provider, model);
    this.name = "LLMQuotaExceededError";
  }
}

/**
 * Thrown when authentication fails (invalid API key)
 * This is a permanent error - scraping should stop immediately
 */
export class LLMAuthenticationError extends LLMError {
  constructor(message: string, provider: string, model: string) {
    super(message, provider, model);
    this.name = "LLMAuthenticationError";
  }
}

/**
 * Thrown when rate limit is hit
 * This is potentially retryable after a delay
 */
export class LLMRateLimitError extends LLMError {
  constructor(
    message: string,
    provider: string,
    model: string,
    public readonly retryAfter?: number,
  ) {
    super(message, provider, model);
    this.name = "LLMRateLimitError";
  }
}

/**
 * Parse API errors and throw appropriate LLM error types
 */
function handleLLMError(
  error: unknown,
  provider: string,
  model: string,
): never {
  const originalMessage = error instanceof Error
    ? error.message
    : String(error);
  const messageLower = originalMessage.toLowerCase();

  // Check for quota/balance errors (402, insufficient balance, quota exceeded)
  if (
    messageLower.includes("insufficient balance") ||
    messageLower.includes("402") ||
    messageLower.includes("quota exceeded") ||
    messageLower.includes("out of credits")
  ) {
    const enhancedMessage =
      `💳 Quota/balance exceeded for ${provider}/${model}. Please check your API credits and billing.`;
    throw new LLMQuotaExceededError(enhancedMessage, provider, model);
  }

  // Check for authentication errors (401, unauthorized, invalid API key)
  if (
    messageLower.includes("authentication fail") ||
    messageLower.includes("401") ||
    messageLower.includes("unauthorized") ||
    messageLower.includes("invalid api key") ||
    messageLower.includes("incorrect api key")
  ) {
    const enhancedMessage =
      `🔐 Authentication failed for ${provider}/${model}. Please check your API key is valid and has the correct permissions.`;
    throw new LLMAuthenticationError(enhancedMessage, provider, model);
  }

  // Check for rate limit errors (429)
  if (
    messageLower.includes("rate limit") ||
    messageLower.includes("429") ||
    messageLower.includes("too many requests")
  ) {
    // Try to extract retry time from error message
    // Groq format: "Please try again in 5m19.3344s"
    // OpenAI format: might include "Please try again in X seconds"
    let retryAfter: number | undefined;
    let retryMessage = "";

    // Match patterns like "5m19.3344s", "24m40.2048s", "30s", "2h15m"
    const retryMatch = originalMessage.match(
      /try again in (\d+h)?(\d+m)?(\d+(?:\.\d+)?s)/i,
    );
    if (retryMatch) {
      const hours = retryMatch[1] ? parseInt(retryMatch[1]) : 0;
      const minutes = retryMatch[2] ? parseInt(retryMatch[2]) : 0;
      const seconds = retryMatch[3] ? parseFloat(retryMatch[3]) : 0;

      // Convert to total seconds
      retryAfter = Math.ceil(hours * 3600 + minutes * 60 + seconds);

      // Format user-friendly message
      if (hours > 0) {
        retryMessage = ` Retry in ${hours}h ${minutes}m.`;
      } else if (minutes > 0) {
        retryMessage = ` Retry in ${minutes}m ${Math.ceil(seconds)}s.`;
      } else {
        retryMessage = ` Retry in ${Math.ceil(seconds)}s.`;
      }
    }

    // Try to extract usage info (Groq format)
    // "Limit 500000, Used 489308, Requested 12540"
    const usageMatch = originalMessage.match(
      /Limit (\d+),\s*Used (\d+),\s*Requested (\d+)/i,
    );
    let usageInfo = "";
    if (usageMatch) {
      const limit = parseInt(usageMatch[1]);
      const used = parseInt(usageMatch[2]);
      const requested = parseInt(usageMatch[3]);
      const remaining = limit - used;
      const percentUsed = ((used / limit) * 100).toFixed(1);

      usageInfo =
        ` Used ${used.toLocaleString()}/${limit.toLocaleString()} tokens (${percentUsed}%, ${remaining.toLocaleString()} remaining).`;
    }

    const enhancedMessage =
      `🚫 Rate limit exceeded for ${provider}/${model}.${usageInfo}${retryMessage}`;
    throw new LLMRateLimitError(enhancedMessage, provider, model, retryAfter);
  }

  // Re-throw original error if not recognized
  if (error instanceof Error) {
    throw error;
  }
  throw new Error(originalMessage);
}

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
 * Convert our ChatMessage format to LangChain BaseMessage format
 */
function convertMessages(messages: ChatMessage[]): BaseMessage[] {
  return messages.map((msg) => {
    switch (msg.role) {
      case "system":
        return new SystemMessage(msg.content);
      case "user":
        return new HumanMessage(msg.content);
      case "assistant":
        return new AIMessage(msg.content);
      default:
        throw new Error(`Unknown message role: ${msg.role}`);
    }
  });
}

/**
 * Create appropriate LangChain chat model based on provider
 */
function createLangChainModel(
  provider: string,
  model: string,
  temperature: number,
  maxTokens: number,
): BaseChatModel {
  switch (provider) {
    case "groq": {
      const apiKey = config.groqApiKey || getEnv("SJS_LLM_API_KEY_GROQ", "");
      return new ChatGroq({
        apiKey,
        model,
        temperature,
        maxTokens,
      });
    }

    case "gemini": {
      const apiKey = config.geminiApiKey ||
        getEnv("SJS_LLM_API_KEY_GEMINI", "");
      return new ChatGoogleGenerativeAI({
        apiKey,
        model,
        temperature,
        maxOutputTokens: maxTokens,
      });
    }

    case "openai": {
      const apiKey = config.openaiApiKey ||
        getEnv("SJS_LLM_API_KEY_OPENAI", "");
      return new ChatOpenAI({
        apiKey,
        model,
        temperature,
        maxTokens,
      });
    }

    case "openrouter": {
      const apiKey = config.openrouterApiKey ||
        getEnv("SJS_LLM_API_KEY_OPENROUTER", "");
      return new ChatOpenAI({
        apiKey,
        model,
        temperature,
        maxTokens,
        configuration: {
          baseURL: "https://openrouter.ai/api/v1",
        },
      });
    }

    case "deepseek": {
      const apiKey = config.deepseekApiKey ||
        getEnv("SJS_LLM_API_KEY_DEEPSEEK", "");
      return new ChatOpenAI({
        apiKey,
        model,
        temperature,
        maxTokens,
        configuration: {
          baseURL: "https://api.deepseek.com",
        },
      });
    }

    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * Convert ResponseFormat JSON schema to Zod schema
 * This is a simplified conversion that handles basic types
 */
function jsonSchemaToZod(schema: Record<string, any>): z.ZodType<any> {
  if (schema.type === "object" && schema.properties) {
    const shape: Record<string, z.ZodType<any>> = {};

    for (
      const [key, value] of Object.entries(
        schema.properties as Record<string, any>,
      )
    ) {
      let zodType: z.ZodType<any>;

      // Handle different types
      switch (value.type) {
        case "string":
          zodType = z.string();
          if (value.description) {
            zodType = zodType.describe(value.description);
          }
          break;
        case "number":
          zodType = z.number();
          if (value.description) {
            zodType = zodType.describe(value.description);
          }
          break;
        case "boolean":
          zodType = z.boolean();
          if (value.description) {
            zodType = zodType.describe(value.description);
          }
          break;
        case "array":
          if (value.items) {
            const itemSchema = jsonSchemaToZod(value.items);
            zodType = z.array(itemSchema);
          } else {
            zodType = z.array(z.any());
          }
          if (value.description) {
            zodType = zodType.describe(value.description);
          }
          break;
        case "object":
          zodType = jsonSchemaToZod(value);
          break;
        default:
          zodType = z.any();
      }

      // Handle optional fields
      if (schema.required && !schema.required.includes(key)) {
        zodType = zodType.optional();
      }

      shape[key] = zodType;
    }

    return z.object(shape);
  }

  // Fallback for non-object schemas
  return z.any();
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
 * Handle Gemini system instruction limit
 * Gemini has a ~1000 character limit on systemInstruction
 */
function handleGeminiSystemMessageLimit(
  messages: ChatMessage[],
): ChatMessage[] {
  const SYSTEM_INSTRUCTION_LIMIT = 1000;
  const systemMessage = messages.find((m) => m.role === "system");

  if (!systemMessage) return messages;

  // If system message is short enough, keep as is
  if (systemMessage.content.length <= SYSTEM_INSTRUCTION_LIMIT) {
    return messages;
  }

  // Otherwise, prepend system message to first user message
  const otherMessages = messages.filter((m) => m.role !== "system");
  const firstUserMessageIndex = otherMessages.findIndex((m) =>
    m.role === "user"
  );

  if (firstUserMessageIndex === -1) {
    // No user message found, keep system message as is
    return messages;
  }

  // Prepend system message to first user message
  const modifiedMessages = [...otherMessages];
  modifiedMessages[firstUserMessageIndex] = {
    role: "user",
    content: `${systemMessage.content}\n\n${
      otherMessages[firstUserMessageIndex].content
    }`,
  };

  return modifiedMessages;
}

/**
 * Generate chat completion using LangChain
 */
async function generateWithLangChain(
  messages: ChatMessage[],
  model: string,
  maxTokens: number,
  temperature: number,
  responseFormat?: ResponseFormat,
): Promise<string> {
  const provider = config.llmProvider;

  try {
    // Handle Gemini system message limit
    let finalMessages = messages;
    if (provider === "gemini") {
      finalMessages = handleGeminiSystemMessageLimit(messages);
    }

    // Create the appropriate LangChain model
    const chatModel = createLangChainModel(
      provider,
      model,
      temperature,
      maxTokens,
    );

    // Convert messages to LangChain format
    const langChainMessages = convertMessages(finalMessages);

    // Handle structured output if responseFormat is provided
    if (responseFormat) {
      // Convert JSON schema to Zod schema
      const zodSchema = jsonSchemaToZod(responseFormat.json_schema.schema);

      // Use withStructuredOutput for structured responses
      const structuredModel = chatModel.withStructuredOutput(zodSchema, {
        name: responseFormat.json_schema.name,
      });

      const result = await structuredModel.invoke(langChainMessages);
      try {
        return JSON.stringify(result);
      } catch (stringifyError) {
        const errorMsg = stringifyError instanceof Error
          ? stringifyError.message
          : String(stringifyError);
        // Try to show a safe representation of the result
        let resultPreview = "[Unable to stringify result]";
        try {
          resultPreview = String(result).substring(0, 500);
        } catch {
          // If even String() fails, use generic message
        }
        throw new Error(
          `Failed to parse JSON response from LLM (${provider}/${model}): ${errorMsg}\nResponse was: ${resultPreview}`,
        );
      }
    }

    // Regular text completion
    const result = await chatModel.invoke(langChainMessages);
    const responseContent = result.content;

    if (typeof responseContent !== "string") {
      throw new Error("Expected string response from LangChain model");
    }

    if (!responseContent) {
      throw new Error(`No content returned from ${provider}`);
    }

    return responseContent;
  } catch (error) {
    handleLLMError(error, provider, model);
  }
}

/**
 * Generate chat completion with structured JSON output
 * When responseFormat is provided, automatically parses the JSON response
 */
export async function generateChatCompletion<T = any>(
  messages: ChatMessage[],
  options: ChatCompletionOptions & { responseFormat: ResponseFormat },
): Promise<T>;

/**
 * Generate chat completion with text output
 * When responseFormat is not provided, returns raw string
 */
export async function generateChatCompletion(
  messages: ChatMessage[],
  options?: ChatCompletionOptions,
): Promise<string>;

export async function generateChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): Promise<string> {
  const {
    model = config.llmModel,
    maxTokens = 8192,
    temperature = 0.7,
    responseFormat,
  } = options;

  // Check cache first
  const cacheKey = generateCacheKey(messages, options);
  const cachedResponse = llmCache.get(cacheKey, model);

  if (cachedResponse) {
    errorTracker.logDebug("LLM cache hit", {
      operation: "generateChatCompletion",
      metadata: { model, provider: config.llmProvider },
    });
    return cachedResponse;
  }

  // Make completion request with retry logic
  const content = await withRetry(
    async () => {
      return await generateWithLangChain(
        messages,
        model,
        maxTokens,
        temperature,
        responseFormat,
      );
    },
    {
      maxAttempts: config.retryMaxAttempts,
      initialDelay: config.retryInitialDelay,
      maxDelay: config.retryMaxDelay,
      shouldRetry: isRetryableError,
    },
  );

  // Parse JSON if responseFormat was provided
  if (responseFormat) {
    try {
      const parsed = JSON.parse(content);

      // Cache the raw response
      llmCache.set(cacheKey, content, model, config.llmCacheTTL);

      errorTracker.logDebug("LLM JSON response parsed and cached", {
        operation: "generateChatCompletion",
        metadata: {
          model,
          provider: config.llmProvider,
          contentLength: content.length,
        },
      });

      return parsed;
    } catch (error) {
      const parseError = new Error(
        `Failed to parse JSON response from LLM (${config.llmProvider}/${model}): ${
          error instanceof Error ? error.message : String(error)
        }\nResponse was: ${content.substring(0, 500)}${
          content.length > 500 ? "..." : ""
        }`,
      );
      throw parseError;
    }
  }

  // Cache the successful response
  llmCache.set(cacheKey, content, model, config.llmCacheTTL);

  errorTracker.logDebug("LLM response generated and cached", {
    operation: "generateChatCompletion",
    metadata: {
      model,
      provider: config.llmProvider,
      contentLength: content.length,
    },
  });

  return content;
}
