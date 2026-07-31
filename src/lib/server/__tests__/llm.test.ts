import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage, StructuredOutputConfig } from "../llm";
import { AIMessage } from "@langchain/core/messages";
import { z } from "zod";

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
    llmModel: "openai/gpt-oss-120b",
  },
}));

// Create hoisted mocks for LangChain
const { mockInvoke, mockWithStructuredOutput, mockGeminiInvoke } = vi.hoisted(
  () => ({
    mockInvoke: vi.fn(),
    mockWithStructuredOutput: vi.fn(),
    mockGeminiInvoke: vi.fn(),
  }),
);

vi.mock("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: class ChatGoogleGenerativeAI {
    constructor(config: any) {}
    async invoke(messages: any, options?: any) {
      return mockGeminiInvoke(messages);
    }
  },
}));

// Mock LangChain Groq
vi.mock("@langchain/groq", () => ({
  ChatGroq: class ChatGroq {
    constructor(config: any) {}
    async invoke(messages: any, options?: any) {
      return mockInvoke(messages);
    }
    withStructuredOutput(schema: any, options?: any) {
      return mockWithStructuredOutput(schema, options);
    }
  },
}));

import { generateChatCompletion } from "../llm";
import { llmCache } from "../llm/cache";

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

    // Mock LangChain response (returns AIMessage)
    mockInvoke.mockResolvedValueOnce(
      new AIMessage("Hi there! How can I help you?"),
    );

    const result = await generateChatCompletion(messages);

    expect(result).toBe("Hi there! How can I help you?");
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ content: "You are a helpful assistant" }),
        expect.objectContaining({ content: "Hello" }),
      ]),
    );
  });

  it("should use custom options", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Test" },
    ];

    mockInvoke.mockResolvedValueOnce(new AIMessage("Response"));

    await generateChatCompletion(messages, {
      model: "custom-model",
      maxTokens: 1024,
      temperature: 0.5,
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ content: "Test" }),
      ]),
    );
  });

  it("should include structured output using Zod schema", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Extract data" },
    ];

    const structuredOutput: StructuredOutputConfig = {
      name: "test_schema",
      schema: z.object({
        name: z.string(),
      }),
    };

    // For Groq provider, structured output uses JSON mode (invoke returns JSON string)
    mockInvoke.mockResolvedValueOnce(
      new AIMessage('{"name": "test"}'),
    );

    const result = await generateChatCompletion(messages, { structuredOutput });

    // Should return parsed JSON object, not string
    expect(result).toEqual({ name: "test" });
    expect(mockInvoke).toHaveBeenCalled();
  });

  it("should throw error if no content is returned", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Test" },
    ];

    // Mock empty response
    mockInvoke.mockResolvedValueOnce(new AIMessage(""));

    await expect(generateChatCompletion(messages)).rejects.toThrow(
      "No content returned from groq",
    );
  });

  it("should throw error if response is not a string", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Test" },
    ];

    // Mock non-string response
    mockInvoke.mockResolvedValueOnce({ content: ["array", "content"] });

    await expect(generateChatCompletion(messages)).rejects.toThrow(
      "Expected string response from LangChain model",
    );
  });

  it("should handle multi-turn conversations", async () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "What's 2+2?" },
      { role: "assistant", content: "4" },
      { role: "user", content: "What's 3+3?" },
    ];

    mockInvoke.mockResolvedValueOnce(new AIMessage("6"));

    const result = await generateChatCompletion(messages);

    expect(result).toBe("6");
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ content: "You are helpful" }),
        expect.objectContaining({ content: "What's 2+2?" }),
        expect.objectContaining({ content: "4" }),
        expect.objectContaining({ content: "What's 3+3?" }),
      ]),
    );
  });

  // A large system prompt used to be deleted and glued onto the FIRST user
  // message on Gemini, on the belief that systemInstruction was capped at 1000
  // characters. Every writing prompt we send is far larger than that, so Gemini
  // was receiving no system message at all — and once threads became real
  // conversations, "first user message" was the oldest turn, which would have
  // buried the whole context block mid-thread.
  describe("Gemini system messages", () => {
    it("keeps a large system message intact instead of merging it", async () => {
      const systemPrompt = "S".repeat(5000);
      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Oldest turn" },
        { role: "assistant", content: "A reply" },
        { role: "user", content: "Newest turn" },
      ];

      mockGeminiInvoke.mockResolvedValueOnce(new AIMessage("ok"));

      const result = await generateChatCompletion(messages, {
        provider: "gemini",
        model: "gemini-2.5-pro",
      });

      expect(result).toBe("ok");
      const sent = mockGeminiInvoke.mock.calls[0][0];
      expect(sent).toHaveLength(4);
      expect(sent[0].getType()).toBe("system");
      expect(sent[0].content).toBe(systemPrompt);
      // The oldest turn must stay exactly what the applicant said.
      expect(sent[1].content).toBe("Oldest turn");
      expect(sent[3].content).toBe("Newest turn");
    });
  });

  it("should propagate API errors", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Test" },
    ];

    mockInvoke.mockRejectedValueOnce(new Error("API Error"));

    await expect(generateChatCompletion(messages)).rejects.toThrow("API Error");
  });

  it("should handle empty message content", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "" },
    ];

    mockInvoke.mockResolvedValueOnce(
      new AIMessage("Please provide a message."),
    );

    const result = await generateChatCompletion(messages);

    expect(result).toBe("Please provide a message.");
  });

  it("should throw descriptive error for invalid JSON when structuredOutput provided", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Extract data" },
    ];

    const structuredOutput: StructuredOutputConfig = {
      name: "test",
      schema: z.object({
        name: z.string(),
      }),
    };

    // For Groq provider, mock invalid JSON response
    mockInvoke.mockResolvedValueOnce(
      new AIMessage("This is not valid JSON"),
    );

    await expect(
      generateChatCompletion(messages, { structuredOutput }),
    ).rejects.toThrow(/Failed to parse JSON response[\s\S]*Response was:/);
  });

  it("should use cache for repeated requests", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Test caching" },
    ];

    mockInvoke.mockResolvedValueOnce(new AIMessage("Cached response"));

    // First call
    const result1 = await generateChatCompletion(messages);
    expect(result1).toBe("Cached response");
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    // Second call - should use cache
    const result2 = await generateChatCompletion(messages);
    expect(result2).toBe("Cached response");
    expect(mockInvoke).toHaveBeenCalledTimes(1); // Still 1, not called again
  });

  it("should handle rate limit errors with enhanced messages", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Test" },
    ];

    const rateLimitError = new Error(
      "Rate limit exceeded. Please try again in 5m30s. Limit 500000, Used 495000, Requested 10000",
    );
    mockInvoke.mockRejectedValueOnce(rateLimitError);

    await expect(generateChatCompletion(messages)).rejects.toThrow(
      /🚫 Rate limit exceeded for groq/,
    );
  });

  it("should handle quota exceeded errors", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Test" },
    ];

    const quotaError = new Error("402: Insufficient balance");
    mockInvoke.mockRejectedValueOnce(quotaError);

    await expect(generateChatCompletion(messages)).rejects.toThrow(
      /💳 Quota\/balance exceeded for groq/,
    );
  });

  it("should handle authentication errors", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Test" },
    ];

    const authError = new Error("401: Invalid API key");
    mockInvoke.mockRejectedValueOnce(authError);

    await expect(generateChatCompletion(messages)).rejects.toThrow(
      /🔐 Authentication failed for groq/,
    );
  });
});
