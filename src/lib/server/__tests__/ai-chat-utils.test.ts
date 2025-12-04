/**
 * Unit tests for AI chat utilities
 * Tests variable replacement and prompt interpolation functionality
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getInterpolatedPrompts, interpolatePrompt } from "../ai-chat-utils";

// Mock the Prisma client
vi.mock("$lib/db", () => ({
  db: {
    ai_chat: {
      findUnique: vi.fn(),
    },
    collected_data: {
      findFirst: vi.fn(),
    },
  },
}));

import { db } from "$lib/db";

describe("interpolatePrompt", () => {
  it("should replace single variable occurrence", () => {
    const text = "Hello ${name}!";
    const result = interpolatePrompt(text, { schema: "", data: "" });
    expect(result).toBe("Hello ${name}!");
  });

  it("should replace schema variable", () => {
    const text = "Schema: ${schema}";
    const result = interpolatePrompt(text, {
      schema: '{"type": "object"}',
      data: "{}",
    });
    expect(result).toBe('Schema: {"type": "object"}');
  });

  it("should replace data variable", () => {
    const text = "Data: ${data}";
    const result = interpolatePrompt(text, {
      schema: "{}",
      data: '{"name": "John"}',
    });
    expect(result).toBe('Data: {"name": "John"}');
  });

  it("should handle multiple variables", () => {
    const text = "Schema: ${schema}, Data: ${data}";
    const result = interpolatePrompt(text, {
      schema: "SCHEMA",
      data: "DATA",
    });
    expect(result).toBe("Schema: SCHEMA, Data: DATA");
  });

  it("should handle JSON in replacement value", () => {
    const text = "Data: ${data}";
    const jsonData = '{"key": "value"}';
    const result = interpolatePrompt(text, {
      schema: "{}",
      data: jsonData,
    });
    expect(result).toBe(`Data: ${jsonData}`);
  });
});

describe("getInterpolatedPrompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null if ai_chat not found", async () => {
    const dbClient = db as any;
    dbClient.ai_chat.findUnique.mockResolvedValueOnce(null);

    const result = await getInterpolatedPrompts(999);

    expect(result).toBeNull();
    expect(dbClient.ai_chat.findUnique).toHaveBeenCalledWith({
      where: { id: 999 },
      select: { system_prompt: true, user_prompt: true, profile: true },
    });
  });

  it("should interpolate prompts with schema and data from collected_data", async () => {
    const dbClient = db as any;

    const mockAiChat = {
      system_prompt: "System: ${schema} - ${data}",
      user_prompt: "User: ${schema} - ${data}",
      profile: 1,
    };

    const mockCollectedData = {
      schema: '{"type": "object"}',
      data: '{"name": "John"}',
    };

    dbClient.ai_chat.findUnique.mockResolvedValueOnce(mockAiChat);
    dbClient.collected_data.findFirst.mockResolvedValueOnce(
      mockCollectedData,
    );
    const result = await getInterpolatedPrompts(1);

    expect(result).toEqual({
      systemPrompt: 'System: {"type": "object"} - {"name": "John"}',
      userPrompt: 'User: {"type": "object"} - {"name": "John"}',
    });
  });

  it("should use empty objects as defaults when collected_data not found", async () => {
    const dbClient = db as any;

    const mockAiChat = {
      system_prompt: "Schema: ${schema}\nData: ${data}",
      user_prompt: "Show me ${schema} and ${data}",
      profile: 1,
    };

    dbClient.ai_chat.findUnique.mockResolvedValueOnce(mockAiChat);
    dbClient.collected_data.findFirst.mockResolvedValueOnce(null);
    const result = await getInterpolatedPrompts(1);

    expect(result).toEqual({
      systemPrompt: "Schema: {}\nData: {}",
      userPrompt: "Show me {} and {}",
    });
  });

  it("should handle null schema and data with empty object defaults", async () => {
    const dbClient = db as any;

    const mockAiChat = {
      system_prompt: "${schema} ${data}",
      user_prompt: "${schema} ${data}",
      profile: 1,
    };

    const mockCollectedData = {
      schema: null,
      data: null,
    };

    dbClient.ai_chat.findUnique.mockResolvedValueOnce(mockAiChat);
    dbClient.collected_data.findFirst.mockResolvedValueOnce(
      mockCollectedData,
    );
    const result = await getInterpolatedPrompts(1);

    expect(result).toEqual({
      systemPrompt: "{} {}",
      userPrompt: "{} {}",
    });
  });

  it("should call collected_data.findFirst with correct profile ID", async () => {
    const dbClient = db as any;
    const profileId = 42;

    dbClient.ai_chat.findUnique.mockResolvedValueOnce({
      system_prompt: "${schema}",
      user_prompt: "${data}",
      profile: profileId,
    });

    dbClient.collected_data.findFirst.mockResolvedValueOnce({
      schema: "{}",
      data: "{}",
    });

    await getInterpolatedPrompts(1);

    expect(dbClient.collected_data.findFirst).toHaveBeenCalledWith({
      where: { profile: profileId },
      select: { schema: true, data: true },
    });
  });

  it("should correctly replace multiple occurrences of both schema and data", async () => {
    const dbClient = db as any;

    const mockAiChat = {
      system_prompt:
        "Use ${schema} to understand the structure of ${data}. The ${schema} is important for ${data}.",
      user_prompt: "I have ${data} which matches ${schema}",
      profile: 1,
    };

    const mockCollectedData = {
      schema: "SCHEMA_VALUE",
      data: "DATA_VALUE",
    };

    dbClient.ai_chat.findUnique.mockResolvedValueOnce(mockAiChat);
    dbClient.collected_data.findFirst.mockResolvedValueOnce(
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
