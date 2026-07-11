/**
 * Unit tests for AI chat response generation
 * Tests Groq API integration and response storage
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Drizzle update chain
const mockUpdateWhere = vi.fn().mockResolvedValue({});
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdateFn = vi.fn().mockReturnValue({ set: mockUpdateSet });

// Mock dependencies
vi.mock("$lib/server/db", () => ({
  db: {
    query: {
      ai_chats: {
        findFirst: vi.fn(),
      },
      profiles: {
        findFirst: vi.fn(),
      },
    },
    update: (...args: any[]) => mockUpdateFn(...args),
  },
}));

vi.mock("$lib/tools/get-env", () => ({
  getEnv: vi.fn((key: string, defaultValue = "") => {
    const envVars: Record<string, string> = {
      SJS_LLM_API_KEY_GROQ: "test-groq-api-key-12345",
    };
    return envVars[key] ?? defaultValue;
  }),
}));

vi.mock("../ai-chat/utils", () => ({
  getInterpolatedPrompts: vi.fn(),
}));

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
const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

// Mock LangChain Groq
vi.mock("@langchain/groq", () => ({
  ChatGroq: class ChatGroq {
    constructor(config: any) {}
    async invoke(messages: any) {
      return mockInvoke(messages);
    }
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: any, val: any) => val),
}));

vi.mock("$lib/server/db/schema", () => ({
  ai_chats: { id: "ai_chats.id" },
  profiles: { id: "profiles.id" },
}));

import { getInterpolatedPrompts } from "../ai-chat/utils";
import { generateAiChatResponse } from "../ai-chat/response-generate";
import { AIMessage } from "@langchain/core/messages";
import { llmCache } from "../llm/cache";

describe("generateAiChatResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateWhere.mockResolvedValue({});
    // Clear LLM cache to prevent cache hits affecting tests
    llmCache.clear();
  });

  it("should return error if ai_chats not found", async () => {
    const utilsMock = getInterpolatedPrompts as any;
    utilsMock.mockResolvedValueOnce(null);

    const result = await generateAiChatResponse(999);

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("should generate response and save to database", async () => {
    const utilsMock = getInterpolatedPrompts as any;

    const mockPrompts = {
      systemPrompt: "You are a helpful assistant",
      userPrompt: "What is the capital of France?",
    };

    utilsMock.mockResolvedValueOnce(mockPrompts);

    mockInvoke.mockResolvedValueOnce(
      new AIMessage("The capital of France is Paris."),
    );

    const result = await generateAiChatResponse(1);

    expect(result.success).toBe(true);
    expect(result.message).toContain("Response generated for AI chat ID 1");
    // Verify db.update was called
    expect(mockUpdateFn).toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        response: "The capital of France is Paris.",
      }),
    );
  });

  it("should call Groq API with correct parameters", async () => {
    const utilsMock = getInterpolatedPrompts as any;

    const mockPrompts = {
      systemPrompt: "You are helpful",
      userPrompt: "Tell me a joke",
    };

    utilsMock.mockResolvedValueOnce(mockPrompts);

    mockInvoke.mockResolvedValueOnce(
      new AIMessage("Why did the chicken cross the road?"),
    );

    await generateAiChatResponse(1);

    // LangChain handles the model invocation internally
    expect(mockInvoke).toHaveBeenCalled();
  });

  it("should handle Groq API error gracefully", async () => {
    const utilsMock = getInterpolatedPrompts as any;
    const mockPrompts = {
      systemPrompt: "You are helpful",
      userPrompt: "Tell me a joke",
    };

    utilsMock.mockResolvedValueOnce(mockPrompts);

    const apiError = new Error("Groq API error: Rate limit exceeded");
    mockInvoke.mockRejectedValueOnce(apiError);

    const result = await generateAiChatResponse(1);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Rate limit exceeded");
    expect(result.message).toContain("groq/openai");
    expect(result.message).toContain("Please try again later");
  });

  it("should handle response with no content", async () => {
    const utilsMock = getInterpolatedPrompts as any;
    const mockPrompts = {
      systemPrompt: "You are helpful",
      userPrompt: "Tell me a joke",
    };

    utilsMock.mockResolvedValueOnce(mockPrompts);

    mockInvoke.mockResolvedValueOnce(new AIMessage(""));

    const result = await generateAiChatResponse(1);

    expect(result.success).toBe(false);
    expect(result.message).toContain("No content returned from groq");
  });

  it("should handle empty choices array", async () => {
    const utilsMock = getInterpolatedPrompts as any;
    const mockPrompts = {
      systemPrompt: "You are helpful",
      userPrompt: "Tell me a joke",
    };

    utilsMock.mockResolvedValueOnce(mockPrompts);

    mockInvoke.mockResolvedValueOnce(new AIMessage(""));

    const result = await generateAiChatResponse(1);

    expect(result.success).toBe(false);
    expect(result.message).toContain("No content returned from groq");
  });

  it("should handle database update error", async () => {
    const utilsMock = getInterpolatedPrompts as any;

    const mockPrompts = {
      systemPrompt: "You are helpful",
      userPrompt: "Tell me a joke",
    };

    utilsMock.mockResolvedValueOnce(mockPrompts);

    mockInvoke.mockResolvedValueOnce(
      new AIMessage("Some response"),
    );

    const dbError = new Error("Database connection failed");
    mockUpdateWhere.mockRejectedValueOnce(dbError);

    const result = await generateAiChatResponse(1);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Error generating response");
    expect(result.message).toContain("Database connection failed");
  });

  it("should use variable interpolation before sending to Groq", async () => {
    const utilsMock = getInterpolatedPrompts as any;

    const mockPrompts = {
      systemPrompt: "Use this schema: {user_schema} to structure response",
      userPrompt: "Use this data: {user_data} to answer",
    };

    // The utility should have already interpolated these
    utilsMock.mockResolvedValueOnce(mockPrompts);

    mockInvoke.mockResolvedValueOnce(
      new AIMessage("Response with interpolated data"),
    );

    const result = await generateAiChatResponse(1);

    // The prompts should be interpolated before being sent to LLM
    expect(mockInvoke).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("should process multiple responses correctly", async () => {
    const utilsMock = getInterpolatedPrompts as any;

    const mockPrompts = {
      systemPrompt: "Be helpful",
      userPrompt: "What is 2+2?",
    };

    utilsMock.mockResolvedValueOnce(mockPrompts);

    mockInvoke.mockResolvedValueOnce(
      new AIMessage("2 + 2 = 4"),
    );

    const result1 = await generateAiChatResponse(1);

    utilsMock.mockResolvedValueOnce(mockPrompts);
    mockInvoke.mockResolvedValueOnce(
      new AIMessage("2 + 2 = 4"),
    );

    const result2 = await generateAiChatResponse(2);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(mockUpdateFn).toHaveBeenCalledTimes(2);
  });
});
