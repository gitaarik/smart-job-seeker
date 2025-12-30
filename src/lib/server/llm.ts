/**
 * Generic LLM utilities for chat completions
 * Supports multiple providers: Groq and Gemini (Google Generative AI)
 */

import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
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
 * Generate chat completion using Groq
 */
async function generateWithGroq(
  messages: ChatMessage[],
  model: string,
  maxTokens: number,
  temperature: number,
  responseFormat?: ResponseFormat,
): Promise<string> {
  const client = new Groq({
    apiKey: config.groqApiKey || getEnv("SJS_GROQ_API_KEY", ""),
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
    throw new Error("No content returned from Groq");
  }

  return responseContent;
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
  const genAI = new GoogleGenerativeAI(
    config.geminiApiKey || getEnv("SJS_GEMINI_API_KEY", ""),
  );

  // Map Groq model names to Google model names if needed
  const googleModel = model.includes("gemini") ? model : "gemini-1.5-flash";

  const genModel = genAI.getGenerativeModel({
    model: googleModel,
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

  // Start chat with system instruction if present
  const chat = genModel.startChat({
    history,
    ...(systemMessage && { systemInstruction: systemMessage.content }),
  });

  const result = await chat.sendMessage(lastMessage.content);
  const response = result.response;
  const responseContent = response.text();

  if (!responseContent) {
    throw new Error("No content returned from Gemini");
  }

  return responseContent;
}

/**
 * Generate a chat completion using the configured LLM provider
 * Supports Groq and Gemini (Google Generative AI)
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
    model = config.llmProvider === "gemini"
      ? "gemini-1.5-flash"
      : "meta-llama/llama-4-scout-17b-16e-instruct",
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
      metadata: { model, provider: config.llmProvider },
    });
    return cachedResponse;
  }

  // Make completion request with retry logic
  const content = await withRetry(
    async () => {
      // Choose provider based on config
      if (config.llmProvider === "gemini") {
        return await generateWithGemini(
          messages,
          model,
          maxTokens,
          temperature,
          responseFormat,
        );
      } else {
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
