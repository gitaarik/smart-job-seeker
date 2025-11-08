/**
 * Unit tests for AI chat utilities
 * Tests variable replacement and prompt interpolation functionality
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getInterpolatedPrompts, replaceVariable } from "../ai-chat-utils";

// Mock the Prisma client
vi.mock("$lib/db", () => ({
  prisma: {
    ai_chat: {
      findUnique: vi.fn(),
    },
    collected_data: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "$lib/db";

describe("replaceVariable", () => {
  it("should replace single variable occurrence", () => {
    const text = "Hello {name}!";
    const result = replaceVariable(text, "name", "World");
    expect(result).toBe("Hello World!");
  });

  it("should replace multiple variable occurrences", () => {
    const text = "I am {name} and I like {hobby}. {name} is great!";
    const result = replaceVariable(text, "name", "Alice");
    expect(result).toBe("I am Alice and I like {hobby}. Alice is great!");
  });

  it("should handle empty variable value", () => {
    const text = "Hello {name}!";
    const result = replaceVariable(text, "name", "");
    expect(result).toBe("Hello !");
  });

  it("should handle text with no variables", () => {
    const text = "Hello World!";
    const result = replaceVariable(text, "name", "Alice");
    expect(result).toBe("Hello World!");
  });

  it("should handle special regex characters in variable value", () => {
    const text = "Pattern: {pattern}";
    const result = replaceVariable(text, "pattern", "[a-z]+$");
    expect(result).toBe("Pattern: [a-z]+$");
  });

  it("should not replace similar but different variable names", () => {
    const text = "{name} and {firstName}";
    const result = replaceVariable(text, "name", "Alice");
    expect(result).toBe("Alice and {firstName}");
  });

  it("should handle JSON in replacement value", () => {
    const text = "Data: {data}";
    const jsonData = '{"key": "value"}';
    const result = replaceVariable(text, "data", jsonData);
    expect(result).toBe(`Data: ${jsonData}`);
  });
});

describe("getInterpolatedPrompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null if ai_chat not found", async () => {
    const prismaClient = prisma as any;
    prismaClient.ai_chat.findUnique.mockResolvedValueOnce(null);

    const result = await getInterpolatedPrompts(999);

    expect(result).toBeNull();
    expect(prismaClient.ai_chat.findUnique).toHaveBeenCalledWith({
      where: { id: 999 },
      select: { system_prompt: true, user_prompt: true, profile: true },
    });
  });

  it("should interpolate prompts with schema and data from collected_data", async () => {
    const prismaClient = prisma as any;

    const mockAiChat = {
      system_prompt: "System: {schema} - {data}",
      user_prompt: "User: {schema} - {data}",
      profile: 1,
    };

    const mockCollectedData = {
      schema: '{"type": "object"}',
      data: '{"name": "John"}',
    };

    prismaClient.ai_chat.findUnique.mockResolvedValueOnce(mockAiChat);
    prismaClient.collected_data.findFirst.mockResolvedValueOnce(
      mockCollectedData,
    );

    const result = await getInterpolatedPrompts(1);

    expect(result).toEqual({
      systemPrompt: 'System: {"type": "object"} - {"name": "John"}',
      userPrompt: 'User: {"type": "object"} - {"name": "John"}',
    });
  });

  it("should use empty objects as defaults when collected_data not found", async () => {
    const prismaClient = prisma as any;

    const mockAiChat = {
      system_prompt: "Schema: {schema}\nData: {data}",
      user_prompt: "Show me {schema} and {data}",
      profile: 1,
    };

    prismaClient.ai_chat.findUnique.mockResolvedValueOnce(mockAiChat);
    prismaClient.collected_data.findFirst.mockResolvedValueOnce(null);

    const result = await getInterpolatedPrompts(1);

    expect(result).toEqual({
      systemPrompt: "Schema: {}\nData: {}",
      userPrompt: "Show me {} and {}",
    });
  });

  it("should handle null schema and data with empty object defaults", async () => {
    const prismaClient = prisma as any;

    const mockAiChat = {
      system_prompt: "{schema} {data}",
      user_prompt: "{schema} {data}",
      profile: 1,
    };

    const mockCollectedData = {
      schema: null,
      data: null,
    };

    prismaClient.ai_chat.findUnique.mockResolvedValueOnce(mockAiChat);
    prismaClient.collected_data.findFirst.mockResolvedValueOnce(
      mockCollectedData,
    );

    const result = await getInterpolatedPrompts(1);

    expect(result).toEqual({
      systemPrompt: "{} {}",
      userPrompt: "{} {}",
    });
  });

  it("should call collected_data.findFirst with correct profile ID", async () => {
    const prismaClient = prisma as any;
    const profileId = 42;

    prismaClient.ai_chat.findUnique.mockResolvedValueOnce({
      system_prompt: "{schema}",
      user_prompt: "{data}",
      profile: profileId,
    });

    prismaClient.collected_data.findFirst.mockResolvedValueOnce({
      schema: "{}",
      data: "{}",
    });

    await getInterpolatedPrompts(1);

    expect(prismaClient.collected_data.findFirst).toHaveBeenCalledWith({
      where: { profile: profileId },
      select: { schema: true, data: true },
    });
  });

  it("should correctly replace multiple occurrences of both schema and data", async () => {
    const prismaClient = prisma as any;

    const mockAiChat = {
      system_prompt:
        "Use {schema} to understand the structure of {data}. The {schema} is important for {data}.",
      user_prompt: "I have {data} which matches {schema}",
      profile: 1,
    };

    const mockCollectedData = {
      schema: "SCHEMA_VALUE",
      data: "DATA_VALUE",
    };

    prismaClient.ai_chat.findUnique.mockResolvedValueOnce(mockAiChat);
    prismaClient.collected_data.findFirst.mockResolvedValueOnce(
      mockCollectedData,
    );

    const result = await getInterpolatedPrompts(1);

    expect(result?.systemPrompt).toBe(
      "Use SCHEMA_VALUE to understand the structure of DATA_VALUE. The SCHEMA_VALUE is important for DATA_VALUE.",
    );
    expect(result?.userPrompt).toBe(
      "I have DATA_VALUE which matches SCHEMA_VALUE",
    );
  });
});
