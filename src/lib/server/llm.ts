/**
 * Generic LLM utilities for chat completions
 * Supports multiple providers: Groq, Gemini (Google Generative AI), OpenAI, and OpenRouter
 */

import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
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
 * Generate a cache key from messages and options
 */
function generateCacheKey(
  messages: ChatMessage[],
  options: ChatCompletionOptions,
): string {
  return JSON.stringify({ messages, options });
}

/**
 * Generate chat completion using Groq
 */
async function generateWithGroq(
  messages: ChatMessage[],
  model: string,
  maxTokens: number,
  temperature: number,
  responseFormat?: ResponseFormat,
): Promise<string> {
  try {
    const client = new Groq({
      apiKey: config.groqApiKey || getEnv("SJS_LLM_API_KEY_GROQ", ""),
    });

    // Groq has limited support for json_schema - only certain models support it
    // Models that support structured outputs: llama-3.1-*, llama-4-*
    // Fall back to simpler json_object format for other models
    let finalResponseFormat = responseFormat;
    let finalMessages = messages;

    if (responseFormat?.type === "json_schema") {
      const supportsJsonSchema = model.includes("llama-3.1") ||
        model.includes("llama-4");
      if (!supportsJsonSchema) {
        // Fall back to simple JSON mode
        finalResponseFormat = { type: "json_object" } as any;

        // Groq requires the word "json" in messages when using json_object format
        // Add instruction to first message if not already present
        const hasJsonMention = messages.some((m) =>
          m.content.toLowerCase().includes("json")
        );
        if (!hasJsonMention) {
          finalMessages = messages.map((m, i) =>
            i === 0
              ? {
                ...m,
                content: m.content +
                  "\n\nIMPORTANT: Return your response as valid JSON.",
              }
              : m
          );
        }
      }
    }

    const completion = await client.chat.completions.create({
      model,
      messages: finalMessages,
      max_tokens: maxTokens,
      temperature,
      ...(finalResponseFormat && { response_format: finalResponseFormat }),
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("No content returned from Groq");
    }

    return responseContent;
  } catch (error) {
    handleLLMError(error, "groq", model);
  }
}

/**
 * Generate chat completion using Gemini (Google Generative AI)
 */
async function generateWithGemini(
  messages: ChatMessage[],
  model: string,
  maxTokens: number,
  temperature: number,
  responseFormat?: ResponseFormat,
): Promise<string> {
  try {
    const genAI = new GoogleGenerativeAI(
      config.geminiApiKey || getEnv("SJS_LLM_API_KEY_GEMINI", ""),
    );

    const genModel = genAI.getGenerativeModel({
      model,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
        ...(responseFormat && { responseMimeType: "application/json" }),
      },
    });

    // Convert messages to Google's format
    const systemMessage = messages.find((m) => m.role === "system");
    const chatMessages = messages.filter((m) => m.role !== "system");

    // Build chat history
    const history = chatMessages.slice(0, -1).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    // Get the last user message
    const lastMessage = chatMessages[chatMessages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
      throw new Error("Last message must be from user");
    }

    // Gemini has a ~1000 character limit on systemInstruction
    // For longer prompts, prepend to user message instead
    const SYSTEM_INSTRUCTION_LIMIT = 1000;
    const useSystemInstruction = systemMessage &&
      systemMessage.content.length <= SYSTEM_INSTRUCTION_LIMIT;

    let finalUserMessage = lastMessage.content;
    if (systemMessage && !useSystemInstruction) {
      // Prepend system prompt to user message for long prompts
      finalUserMessage = `${systemMessage.content}\n\n${lastMessage.content}`;
    }

    // Start chat with system instruction only for short prompts
    const chat = genModel.startChat({
      history,
      ...(useSystemInstruction && { systemInstruction: systemMessage.content }),
    });

    const result = await chat.sendMessage(finalUserMessage);
    const response = result.response;
    const responseContent = response.text();

    if (!responseContent) {
      throw new Error("No content returned from Gemini");
    }

    return responseContent;
  } catch (error) {
    handleLLMError(error, "gemini", model);
  }
}

/**
 * Generate chat completion using OpenAI
 */
async function generateWithOpenAI(
  messages: ChatMessage[],
  model: string,
  maxTokens: number,
  temperature: number,
  responseFormat?: ResponseFormat,
): Promise<string> {
  try {
    const client = new OpenAI({
      apiKey: config.openaiApiKey || getEnv("SJS_LLM_API_KEY_OPENAI", ""),
    });

    const completion = await client.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      ...(responseFormat && { response_format: responseFormat }),
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("No content returned from OpenAI");
    }

    return responseContent;
  } catch (error) {
    handleLLMError(error, "openai", model);
  }
}

/**
 * Generate chat completion using OpenRouter
 */
async function generateWithOpenRouter(
  messages: ChatMessage[],
  model: string,
  maxTokens: number,
  temperature: number,
  responseFormat?: ResponseFormat,
): Promise<string> {
  try {
    const client = new OpenAI({
      apiKey: config.openrouterApiKey ||
        getEnv("SJS_LLM_API_KEY_OPENROUTER", ""),
      baseURL: "https://openrouter.ai/api/v1",
    });

    const completion = await client.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      ...(responseFormat && { response_format: responseFormat }),
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("No content returned from OpenRouter");
    }

    return responseContent;
  } catch (error) {
    handleLLMError(error, "openrouter", model);
  }
}

/**
 * Generate chat completion using DeepSeek
 */
async function generateWithDeepSeek(
  messages: ChatMessage[],
  model: string,
  maxTokens: number,
  temperature: number,
  responseFormat?: ResponseFormat,
): Promise<string> {
  try {
    const client = new OpenAI({
      apiKey: config.deepseekApiKey || getEnv("SJS_LLM_API_KEY_DEEPSEEK", ""),
      baseURL: "https://api.deepseek.com",
    });

    const completion = await client.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      ...(responseFormat && { response_format: responseFormat }),
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("No content returned from DeepSeek");
    }

    return responseContent;
  } catch (error) {
    handleLLMError(error, "deepseek", model);
  }
}

/**
 * Generate a chat completion using the configured LLM provider
 * Supports Groq, Gemini (Google Generative AI), OpenAI, OpenRouter, and DeepSeek
 *
 * Includes caching and retry logic for reliability
 *
 * @param messages Array of chat messages (system, user, assistant)
 * @param options Optional configuration for the completion
 * @returns The generated text response
 * @throws Error if no content is returned from the LLM
 */
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
    model = config.llmModel, // Use custom model or default from config
    maxTokens = 8192, // Increased from 2048 to handle larger responses (e.g., many job links)
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
      // Choose provider based on config
      switch (config.llmProvider) {
        case "gemini":
          return await generateWithGemini(
            messages,
            model,
            maxTokens,
            temperature,
            responseFormat,
          );
        case "openai":
          return await generateWithOpenAI(
            messages,
            model,
            maxTokens,
            temperature,
            responseFormat,
          );
        case "openrouter":
          return await generateWithOpenRouter(
            messages,
            model,
            maxTokens,
            temperature,
            responseFormat,
          );
        case "deepseek":
          return await generateWithDeepSeek(
            messages,
            model,
            maxTokens,
            temperature,
            responseFormat,
          );
        default: // groq
          return await generateWithGroq(
            messages,
            model,
            maxTokens,
            temperature,
            responseFormat,
          );
      }
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
