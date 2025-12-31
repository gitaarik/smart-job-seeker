import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage, ResponseFormat } from "../llm";

// Mock getEnv
vi.mock("$lib/tools/get-env", () => ({
  getEnv: vi.fn(() => "test-api-key"),
}));

// Mock config
vi.mock("../config", () => ({
  config: {
    groqApiKey: "test-api-key",
    retryMaxAttempts: 3,
    retryInitialDelay: 1000,
    retryMaxDelay: 10000,
    llmCacheTTL: 3600000,
    llmProvider: "groq",
    llmModel: "meta-llama/llama-4-scout-17b-16e-instruct",
  },
}));

// Create hoisted mock
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

// Mock Groq SDK
vi.mock("groq-sdk", () => ({
  default: class Groq {
    constructor(config: any) {}
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

import { generateChatCompletion } from "../llm";
import { llmCache } from "../cache/llm-cache";

describe("generateChatCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear LLM cache to prevent cache hits affecting tests
    llmCache.clear();
  });

  it("should generate chat completion with default options", async () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello" },
    ];

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "Hi there! How can I help you?",
          },
        },
      ],
    });

    const result = await generateChatCompletion(messages);

    expect(result).toBe("Hi there! How can I help you?");
    expect(mockCreate).toHaveBeenCalledWith({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages,
      max_tokens: 2048,
      temperature: 0.7,
    });
  });

  it("should use custom options", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Test" },
    ];

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "Response",
          },
        },
      ],
    });

    await generateChatCompletion(messages, {
      model: "custom-model",
      maxTokens: 1024,
      temperature: 0.5,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      model: "custom-model",
      messages,
      max_tokens: 1024,
      temperature: 0.5,
    });
  });

  it("should include response format for structured output", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Extract data" },
    ];

    const responseFormat: ResponseFormat = {
      type: "json_schema",
      json_schema: {
        name: "test_schema",
        strict: true,
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
        },
      },
    };

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '{"name": "test"}',
          },
        },
      ],
    });

    const result = await generateChatCompletion(messages, { responseFormat });

    expect(result).toBe('{"name": "test"}');
    expect(mockCreate).toHaveBeenCalledWith({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages,
      max_tokens: 2048,
      temperature: 0.7,
      response_format: responseFormat,
    });
  });

  it("should throw error if no content is returned", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Test" },
    ];

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: null,
          },
        },
      ],
    });

    await expect(generateChatCompletion(messages)).rejects.toThrow(
      "No content returned from Groq",
    );
  });

  it("should throw error if choices array is empty", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Test" },
    ];

    mockCreate.mockResolvedValueOnce({
      choices: [],
    });

    await expect(generateChatCompletion(messages)).rejects.toThrow(
      "No content returned from Groq",
    );
  });

  it("should throw error if no choices in response", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Test" },
    ];

    mockCreate.mockResolvedValueOnce({});

    await expect(generateChatCompletion(messages)).rejects.toThrow();
  });

  it("should handle multi-turn conversations", async () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "What's 2+2?" },
      { role: "assistant", content: "4" },
      { role: "user", content: "What's 3+3?" },
    ];

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "6",
          },
        },
      ],
    });

    const result = await generateChatCompletion(messages);

    expect(result).toBe("6");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages,
      }),
    );
  });

  it("should propagate API errors", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Test" },
    ];

    mockCreate.mockRejectedValueOnce(new Error("API Error"));

    await expect(generateChatCompletion(messages)).rejects.toThrow("API Error");
  });

  it("should handle empty message content", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "" },
    ];

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "Please provide a message.",
          },
        },
      ],
    });

    const result = await generateChatCompletion(messages);

    expect(result).toBe("Please provide a message.");
  });
});
