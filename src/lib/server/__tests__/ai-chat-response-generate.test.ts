/**
 * Unit tests for AI chat response generation
 * Tests Groq API integration and response storage
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("$lib/db", () => ({
  db: {
    ai_chat: {
      update: vi.fn(),
    },
  },
}));

vi.mock("$lib/tools/get-env", () => ({
  getEnv: vi.fn((key: string, defaultValue = "") => {
    const envVars: Record<string, string> = {
      GROQ_API_KEY: "test-groq-api-key-12345",
    };
    return envVars[key] ?? defaultValue;
  }),
}));

vi.mock("../ai-chat-utils", () => ({
  getInterpolatedPrompts: vi.fn(),
}));

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

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

import { db } from "$lib/db";
import { getInterpolatedPrompts } from "../ai-chat-utils";
import { generateAiChatResponse } from "../ai-chat-response-generate";
import Groq from "groq-sdk";

describe("generateAiChatResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return error if ai_chat not found", async () => {
    const utilsMock = getInterpolatedPrompts as any;
    utilsMock.mockResolvedValueOnce(null);

    const result = await generateAiChatResponse(999);

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("should generate response and save to database", async () => {
    const utilsMock = getInterpolatedPrompts as any;
    const dbClient = db as any;

    const mockPrompts = {
      systemPrompt: "You are a helpful assistant",
      userPrompt: "What is the capital of France?",
    };

    utilsMock.mockResolvedValueOnce(mockPrompts);

    const mockResponse = {
      choices: [
        {
          message: {
            content: "The capital of France is Paris.",
          },
        },
      ],
    };

    mockCreate.mockResolvedValueOnce(mockResponse);
    dbClient.ai_chat.update.mockResolvedValueOnce({});

    const result = await generateAiChatResponse(1);

    expect(result.success).toBe(true);
    expect(result.message).toContain("Response generated for AI chat ID 1");
    expect(dbClient.ai_chat.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { response: "The capital of France is Paris." },
    });
  });

  it("should call Groq API with correct parameters", async () => {
    const utilsMock = getInterpolatedPrompts as any;
    const dbClient = db as any;

    const mockPrompts = {
      systemPrompt: "You are helpful",
      userPrompt: "Tell me a joke",
    };

    utilsMock.mockResolvedValueOnce(mockPrompts);

    const mockResponse = {
      choices: [
        {
          message: {
            content: "Why did the chicken cross the road?",
          },
        },
      ],
    };

    mockCreate.mockResolvedValueOnce(mockResponse);
    dbClient.ai_chat.update.mockResolvedValueOnce({});

    await generateAiChatResponse(1);

    expect(mockCreate).toHaveBeenCalledWith({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "system",
          content: "You are helpful",
        },
        {
          role: "user",
          content: "Tell me a joke",
        },
      ],
      max_tokens: 2048,
      temperature: 0.7,
    });
  });

  it("should handle Groq API error gracefully", async () => {
    const utilsMock = getInterpolatedPrompts as any;
    const mockPrompts = {
      systemPrompt: "You are helpful",
      userPrompt: "Tell me a joke",
    };

    utilsMock.mockResolvedValueOnce(mockPrompts);

    const apiError = new Error("Groq API error: Rate limit exceeded");
    mockCreate.mockRejectedValueOnce(apiError);

    const result = await generateAiChatResponse(1);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Error generating response");
    expect(result.message).toContain("Rate limit exceeded");
  });

  it("should handle response with no content", async () => {
    const utilsMock = getInterpolatedPrompts as any;
    const mockPrompts = {
      systemPrompt: "You are helpful",
      userPrompt: "Tell me a joke",
    };

    utilsMock.mockResolvedValueOnce(mockPrompts);

    const mockResponse = {
      choices: [
        {
          message: {
            content: null,
          },
        },
      ],
    };

    mockCreate.mockResolvedValueOnce(mockResponse);

    const result = await generateAiChatResponse(1);

    expect(result.success).toBe(false);
    expect(result.message).toContain("No response generated");
  });

  it("should handle empty choices array", async () => {
    const utilsMock = getInterpolatedPrompts as any;
    const mockPrompts = {
      systemPrompt: "You are helpful",
      userPrompt: "Tell me a joke",
    };

    utilsMock.mockResolvedValueOnce(mockPrompts);

    const mockResponse = {
      choices: [],
    };

    mockCreate.mockResolvedValueOnce(mockResponse);

    const result = await generateAiChatResponse(1);

    expect(result.success).toBe(false);
    expect(result.message).toContain("No response generated");
  });

  it("should handle database update error", async () => {
    const utilsMock = getInterpolatedPrompts as any;
    const dbClient = db as any;

    const mockPrompts = {
      systemPrompt: "You are helpful",
      userPrompt: "Tell me a joke",
    };

    utilsMock.mockResolvedValueOnce(mockPrompts);

    const mockResponse = {
      choices: [
        {
          message: {
            content: "Why did the chicken cross the road?",
          },
        },
      ],
    };

    mockCreate.mockResolvedValueOnce(mockResponse);

    const dbError = new Error("Database connection failed");
    dbClient.ai_chat.update.mockRejectedValueOnce(dbError);

    const result = await generateAiChatResponse(1);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Error generating response");
    expect(result.message).toContain("Database connection failed");
  });

  it("should use variable interpolation before sending to Groq", async () => {
    const utilsMock = getInterpolatedPrompts as any;
    const dbClient = db as any;

    const mockPrompts = {
      systemPrompt: "Use this schema: {user_schema} to structure response",
      userPrompt: "Use this data: {user_data} to answer",
    };

    // The utility should have already interpolated these
    utilsMock.mockResolvedValueOnce(mockPrompts);

    const mockResponse = {
      choices: [
        {
          message: {
            content: "Response with interpolated data",
          },
        },
      ],
    };

    mockCreate.mockResolvedValueOnce(mockResponse);
    dbClient.ai_chat.update.mockResolvedValueOnce({});

    await generateAiChatResponse(1);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].content).toBe(mockPrompts.systemPrompt);
    expect(callArgs.messages[1].content).toBe(mockPrompts.userPrompt);
  });

  it("should process multiple responses correctly", async () => {
    const utilsMock = getInterpolatedPrompts as any;
    const dbClient = db as any;

    const mockPrompts = {
      systemPrompt: "Be helpful",
      userPrompt: "What is 2+2?",
    };

    utilsMock.mockResolvedValueOnce(mockPrompts);

    const mockResponse = {
      choices: [
        {
          message: {
            content: "2 + 2 = 4",
          },
        },
      ],
    };

    mockCreate.mockResolvedValueOnce(mockResponse);
    dbClient.ai_chat.update.mockResolvedValueOnce({});

    const result1 = await generateAiChatResponse(1);

    utilsMock.mockResolvedValueOnce(mockPrompts);
    mockCreate.mockResolvedValueOnce(mockResponse);
    dbClient.ai_chat.update.mockResolvedValueOnce({});

    const result2 = await generateAiChatResponse(2);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(dbClient.ai_chat.update).toHaveBeenCalledTimes(2);
  });
});
