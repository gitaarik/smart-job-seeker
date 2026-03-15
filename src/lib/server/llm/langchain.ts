/**
 * LangChain-based LLM utilities for chat completions
 * Supports multiple providers: Groq, Gemini (Google Generative AI), OpenAI, DeepSeek, and Cerebras
 */

import { ChatGroq } from "@langchain/groq";
import { ChatCerebras } from "@langchain/cerebras";
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
import { llmCache } from "./cache";
import { isRetryableError, withRetry } from "$lib/server/utils/retry";
import { errorTracker } from "$lib/server/monitoring/error-tracker";
import { config } from "$lib/server/config";

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

  // Brief error log - full details are stored in ai_chat.error field
  const truncatedMessage = originalMessage.length > 150
    ? originalMessage.substring(0, 150) + "..."
    : originalMessage;
  console.error(`[LLM Error] ${provider}/${model}: ${truncatedMessage}`);

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
    // Try to extract status code and additional error details
    let statusCode = "";
    let apiErrorDetails = "";

    // Check if error object has additional properties (from LangChain/API)
    if (error && typeof error === "object") {
      const errorObj = error as any;

      // Try to get status code
      if (errorObj.status) {
        statusCode = ` (HTTP ${errorObj.status})`;
      } else if (errorObj.statusCode) {
        statusCode = ` (HTTP ${errorObj.statusCode})`;
      }

      // Try to get response body or additional error info
      if (errorObj.response?.data) {
        try {
          const responseData = typeof errorObj.response.data === "string"
            ? errorObj.response.data
            : JSON.stringify(errorObj.response.data);
          apiErrorDetails = ` API response: ${responseData.substring(0, 200)}`;
        } catch {
          // Ignore JSON stringify errors
        }
      } else if (errorObj.error?.message) {
        apiErrorDetails = ` Details: ${errorObj.error.message}`;
      }
    }

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
      `🚫 Rate limit exceeded for ${provider}/${model}${statusCode}.${usageInfo}${retryMessage}${
        apiErrorDetails ? "\n" + apiErrorDetails : ""
      }\n\nOriginal error: ${originalMessage}`;
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
/**
 * Structured output configuration using Zod schema
 */
export interface StructuredOutputConfig {
  name: string;
  schema: z.ZodType<any>;
}

/**
 * Options for chat completion requests
 */
export interface ChatCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  structuredOutput?: StructuredOutputConfig;
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
      const apiKey = config.geminiApiKey;
      return new ChatGoogleGenerativeAI({
        apiKey,
        model,
        temperature,
        maxOutputTokens: maxTokens,
      });
    }

    case "openai": {
      const apiKey = config.openaiApiKey;
      return new ChatOpenAI({
        apiKey,
        model,
        temperature,
        maxTokens,
      });
    }

    case "deepseek": {
      const apiKey = config.deepseekApiKey;
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

    case "cerebras": {
      const apiKey = config.cerebrasApiKey;
      if (!apiKey) {
        throw new LLMAuthenticationError(
          "Cerebras API key not configured. Set SJS_LLM_API_KEY_CEREBRAS.",
          "cerebras",
          model,
        );
      }
      return new ChatCerebras({
        apiKey,
        model,
        temperature,
        maxTokens,
      });
    }

    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * Note: jsonSchemaToZod() function has been removed.
 * Zod schemas are now defined directly in code at src/lib/server/schemas/ai-prompt-schemas.ts
 */

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
  structuredOutput?: StructuredOutputConfig,
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

    // Handle structured output if structuredOutput is provided
    if (structuredOutput) {
      // Use Zod schema directly (no conversion needed)
      const zodSchema = structuredOutput.schema;

      // For Groq and Cerebras, use JSON mode instead of structured output (tool calling)
      // These providers' tool calling has strict validation that conflicts with our schemas
      if (provider === "groq" || provider === "cerebras") {
        // IMPORTANT: Do NOT use zodToJsonSchema here - Llama 4 tends to echo JSON schema definitions
        // Instead, we rely on the system prompt already describing the expected output format
        // The structuredOutput.name tells us what type of response we expect

        // Add a simple reminder to output JSON data (not schema)
        const lastMessage = langChainMessages[langChainMessages.length - 1];
        if (lastMessage instanceof HumanMessage) {
          lastMessage.content = lastMessage.content +
            "\n\nIMPORTANT: Output ONLY a valid JSON object with actual DATA values. " +
            "Do NOT output a JSON Schema definition. Do NOT include $ref, definitions, type declarations, or schema metadata. " +
            "Just output the extracted data as JSON.";
        }

        // Invoke with JSON mode enabled to ensure valid JSON output
        const result = await chatModel.invoke(langChainMessages, {
          response_format: { type: "json_object" },
        });
        const responseContent = typeof result.content === "string"
          ? result.content
          : String(result.content);

        // Parse and validate JSON response
        // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
        let jsonContent = responseContent.trim();
        const codeBlockMatch = jsonContent.match(
          /```(?:json)?\s*\n([\s\S]*?)\n```/,
        );
        if (codeBlockMatch) {
          jsonContent = codeBlockMatch[1].trim();
        }

        // Try to parse JSON, with repair attempt for truncated responses
        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonContent);
        } catch (jsonError) {
          // Check if JSON appears truncated (missing closing braces/brackets)
          const openBraces = (jsonContent.match(/{/g) || []).length;
          const closeBraces = (jsonContent.match(/}/g) || []).length;
          const openBrackets = (jsonContent.match(/\[/g) || []).length;
          const closeBrackets = (jsonContent.match(/]/g) || []).length;
          const isTruncated = openBraces > closeBraces ||
            openBrackets > closeBrackets;

          if (isTruncated) {
            // Try to repair truncated JSON by closing incomplete strings and adding missing brackets/braces
            let repairedJson = jsonContent;

            // If we're inside a string (odd number of unescaped quotes after last complete value)
            // Try to close it
            const lastQuoteIndex = repairedJson.lastIndexOf('"');
            const afterLastQuote = repairedJson.substring(lastQuoteIndex + 1);
            if (lastQuoteIndex > 0 && !afterLastQuote.includes('"') && !afterLastQuote.match(/[}\],:]/)) {
              // We're likely inside an unclosed string - close it with null
              // Find the last complete key-value and truncate there
              const lastCompleteMatch = repairedJson.match(/^([\s\S]*[}\],])\s*"[^"]*"?\s*:?\s*"?[^"]*$/);
              if (lastCompleteMatch) {
                repairedJson = lastCompleteMatch[1];
              }
            }

            // Add missing closing brackets and braces
            const missingBrackets = openBrackets - (repairedJson.match(/]/g) || []).length;
            const missingBraces = openBraces - (repairedJson.match(/}/g) || []).length;
            repairedJson += "]".repeat(missingBrackets) + "}".repeat(missingBraces);

            try {
              parsed = JSON.parse(repairedJson);
              console.log(`      ⚠️ Repaired truncated JSON (closed ${missingBrackets} brackets, ${missingBraces} braces)`);
            } catch {
              // Repair failed, throw original error with truncation details
              throw new Error(
                `${provider} JSON response appears truncated (output token limit likely exceeded). ` +
                  `Missing ${openBraces - closeBraces} closing braces, ${
                    openBrackets - closeBrackets
                  } closing brackets. ` +
                  `Response length: ${responseContent.length} chars. Last 200 chars: ...${
                    responseContent.slice(-200)
                  }`,
              );
            }
          } else {
            const errorMsg = jsonError instanceof Error
              ? jsonError.message
              : String(jsonError);
            throw new Error(
              `Failed to parse JSON response from ${provider}: ${errorMsg}\nResponse was: ${
                responseContent.substring(0, 500)
              }`,
            );
          }
        }

        // Normalize response format before validation
        // LLMs sometimes return unwrapped responses (single object or array instead of {jobs: [...]})
        let normalizedParsed = parsed;
        if (structuredOutput.name.includes("extract_jobs")) {
          // For job extraction, ensure response has {jobs: [...]} wrapper
          if (Array.isArray(parsed)) {
            // LLM returned bare array - wrap it
            normalizedParsed = { jobs: parsed };
          } else if (parsed && typeof parsed === "object" && !("jobs" in parsed)) {
            // LLM returned single job object - wrap in array
            if ("clickableId" in parsed || "title" in parsed) {
              normalizedParsed = { jobs: [parsed] };
            }
          }
        }

        // Validate against Zod schema
        try {
          const validated = zodSchema.parse(normalizedParsed);
          return JSON.stringify(validated);
        } catch (zodError) {
          const errorMsg = zodError instanceof Error
            ? zodError.message
            : String(zodError);
          throw new Error(
            `Failed to parse JSON response from ${provider}: ${errorMsg}\nResponse was: ${
              responseContent.substring(0, 500)
            }`,
          );
        }
      }

      // For other providers, use withStructuredOutput
      const structuredModel = chatModel.withStructuredOutput(zodSchema, {
        name: structuredOutput.name,
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
 * When structuredOutput is provided, automatically parses the JSON response
 */
export async function generateChatCompletion<T = any>(
  messages: ChatMessage[],
  options: ChatCompletionOptions & { structuredOutput: StructuredOutputConfig },
): Promise<T>;

/**
 * Generate chat completion with text output
 * When structuredOutput is not provided, returns raw string
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
    structuredOutput,
  } = options;

  // Check cache first
  const cacheKey = generateCacheKey(messages, options);
  const cachedResponse = llmCache.get(cacheKey, model);

  if (cachedResponse) {
    if (structuredOutput) {
      return JSON.parse(cachedResponse);
    }
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
        structuredOutput,
      );
    },
    {
      maxAttempts: config.retryMaxAttempts,
      initialDelay: config.retryInitialDelay,
      maxDelay: config.retryMaxDelay,
      shouldRetry: isRetryableError,
    },
  );

  // Parse JSON if structuredOutput was provided
  if (structuredOutput) {
    try {
      const parsed = JSON.parse(content);

      // Cache the raw response
      llmCache.set(cacheKey, content, model, config.llmCacheTTL);

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

  return content;
}
