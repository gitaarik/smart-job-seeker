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

  // Groq has limited support for json_schema - only certain models support it
  // Models that support structured outputs: llama-3.1-70b-versatile, llama-3.1-8b-instant
  // Fall back to simpler json_object format for other models
  let finalResponseFormat = responseFormat;
  let finalMessages = messages;

  if (responseFormat?.type === "json_schema") {
    const supportsJsonSchema = model.includes("llama-3.1");
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
  const client = new OpenAI({
    apiKey: config.openaiApiKey || getEnv("SJS_OPENAI_API_KEY", ""),
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
  const client = new OpenAI({
    apiKey: config.openrouterApiKey || getEnv("SJS_OPENROUTER_API_KEY", ""),
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
}

/**
 * Generate a chat completion using the configured LLM provider
 * Supports Groq, Gemini (Google Generative AI), OpenAI, and OpenRouter
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
    model = config.llmModel, // Use custom model or default from config
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
