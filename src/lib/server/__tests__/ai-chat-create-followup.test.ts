/**
 * Unit tests for ai-chat-create-followup
 * Tests the core followup creation functionality
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Drizzle update chain
const mockUpdateWhere = vi.fn().mockResolvedValue({});
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

// Mock the database with Drizzle-style API
vi.mock("$lib/server/db", () => ({
  db: {
    query: {
      ai_chats: {
        findFirst: vi.fn(),
      },
      application_letters: {
        findMany: vi.fn(),
      },
      application_questions: {
        findMany: vi.fn(),
      },
    },
    update: (...args: any[]) => mockUpdate(...args),
  },
}));

// Mock ai-chat-utils
vi.mock("$lib/server/ai-chat/utils", () => ({
  createAndGenerateAiChat: vi.fn(),
  interpolatePrompt: vi.fn((template, vars) => {
    // Simple mock interpolation
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(
        new RegExp(`\\$\\{${key}\\}`, "g"),
        String(value),
      );
    }
    return result;
  }),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: any, val: any) => val),
}));

vi.mock("$lib/server/db/schema", () => ({
  ai_chats: { id: "ai_chats.id" },
  application_letters: { ai_chat_id: "application_letters.ai_chat_id" },
  application_questions: { ai_chat_id: "application_questions.ai_chat_id" },
}));

import { db } from "$lib/server/db";
import {
  createAndGenerateAiChat,
  interpolatePrompt,
} from "$lib/server/ai-chat/utils";
import { createFollowupAiChat } from "../ai-chat/create-followup";

describe("createFollowupAiChat", () => {
  const mockParentAiChat = {
    id: 1,
    profile_id: 123,
    context: {
      jobTitle: "Senior Developer",
      company: "Acme Corp",
      applicationId: 456,
    },
    response: "This is the previous AI response that needs refinement.",
    system_prompt: "You are a helpful assistant. Job: ${jobTitle}",
    user_prompt: "Write a cover letter for ${company}",
    followup_to: null,
  };

  const mockCreatedAiChat = {
    id: 2,
    profile_id: 123,
    system_prompt: "Refine the previous response",
    user_prompt: "Make it shorter",
    full_prompt: "System: Refine...\nUser: Make it shorter",
    response: "Refined response",
    date_created: new Date(),
    date_updated: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateWhere.mockResolvedValue({});
  });

  describe("validation", () => {
    it("should return error if parent ai_chats not found", async () => {
      (db.query.ai_chats.findFirst as any).mockResolvedValueOnce(null);

      const result = await createFollowupAiChat(
        999,
        "Make it better",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("Parent ai_chats with ID 999 not found");
      expect(db.query.ai_chats.findFirst).toHaveBeenCalled();
    });

    it("should return error if parent has no response", async () => {
      (db.query.ai_chats.findFirst as any).mockResolvedValueOnce({
        ...mockParentAiChat,
        response: null,
      });

      const result = await createFollowupAiChat(
        1,
        "Make it better",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain(
        "does not have a response yet. Cannot create follow-up",
      );
    });

    it("should return error if parent has empty response", async () => {
      (db.query.ai_chats.findFirst as any).mockResolvedValueOnce({
        ...mockParentAiChat,
        response: "",
      });

      const result = await createFollowupAiChat(
        1,
        "Make it better",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("does not have a response yet");
    });
  });

  describe("followup creation without original context", () => {
    it("should create followup with escaped placeholders by default", async () => {
      (db.query.ai_chats.findFirst as any).mockResolvedValueOnce(mockParentAiChat);

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      (db.query.application_letters.findMany as any).mockResolvedValueOnce([]);
      (db.query.application_questions.findMany as any).mockResolvedValueOnce([]);

      const result = await createFollowupAiChat(
        1,
        "Make it more concise",
      );

      expect(result.success).toBe(true);
      expect(mockCreateAndGenerateAiChat).toHaveBeenCalledWith(
        123, // profile
        "followup", // template
        expect.objectContaining({
          previousResponse: mockParentAiChat.response,
          followupRequest: "Make it more concise",
          // Placeholders should be escaped
          originalSystemPrompt: expect.stringContaining("\\${jobTitle}"),
          originalUserPrompt: expect.stringContaining("\\${company}"),
        }),
        1, // parent ai_chats id
        { profileDataFields: [] },
      );
    });

    it("should include previous response in custom variables", async () => {
      (db.query.ai_chats.findFirst as any).mockResolvedValueOnce(mockParentAiChat);

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      (db.query.application_letters.findMany as any).mockResolvedValueOnce([]);
      (db.query.application_questions.findMany as any).mockResolvedValueOnce([]);

      await createFollowupAiChat(1, "Make it better");

      expect(mockCreateAndGenerateAiChat).toHaveBeenCalledWith(
        expect.any(Number),
        "followup",
        expect.objectContaining({
          previousResponse:
            "This is the previous AI response that needs refinement.",
        }),
        expect.any(Number),
        { profileDataFields: [] },
      );
    });
  });

  describe("followup creation with original context", () => {
    it("should interpolate original context when includeOriginalContext is true", async () => {
      (db.query.ai_chats.findFirst as any).mockResolvedValueOnce(mockParentAiChat);

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      (db.query.application_letters.findMany as any).mockResolvedValueOnce([]);
      (db.query.application_questions.findMany as any).mockResolvedValueOnce([]);

      await createFollowupAiChat(1, "Make it better", {
        includeOriginalContext: true,
      });

      // Verify interpolatePrompt was called with parent's context
      const mockInterpolate = interpolatePrompt as any;
      expect(mockInterpolate).toHaveBeenCalledWith(
        mockParentAiChat.system_prompt,
        expect.objectContaining({
          jobTitle: "Senior Developer",
          company: "Acme Corp",
        }),
      );

      expect(mockInterpolate).toHaveBeenCalledWith(
        mockParentAiChat.user_prompt,
        expect.objectContaining({
          jobTitle: "Senior Developer",
          company: "Acme Corp",
        }),
      );
    });

    it("should handle complex context objects when interpolating", async () => {
      const complexContext = {
        jobTitle: "Senior Developer",
        skills: ["React", "TypeScript", "Node.js"],
        salary: { min: 80000, max: 120000 },
      };

      (db.query.ai_chats.findFirst as any).mockResolvedValueOnce({
        ...mockParentAiChat,
        context: complexContext,
      });

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      (db.query.application_letters.findMany as any).mockResolvedValueOnce([]);
      (db.query.application_questions.findMany as any).mockResolvedValueOnce([]);

      await createFollowupAiChat(1, "Refine", {
        includeOriginalContext: true,
      });

      const mockInterpolate = interpolatePrompt as any;
      expect(mockInterpolate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          jobTitle: "Senior Developer",
          skills: expect.stringContaining("React"),
          salary: expect.stringContaining("80000"),
        }),
      );
    });
  });

  describe("auto-update linked records", () => {
    it("should update linked application_letters with new ai_chats reference", async () => {
      (db.query.ai_chats.findFirst as any).mockResolvedValueOnce(mockParentAiChat);

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      // Simulate 2 linked letters
      (db.query.application_letters.findMany as any).mockResolvedValueOnce([{ id: 10 }, { id: 11 }]);
      (db.query.application_questions.findMany as any).mockResolvedValueOnce([]);

      const result = await createFollowupAiChat(1, "Refine");

      expect(result.success).toBe(true);
      // Verify db.update was called for letters
      expect(mockUpdate).toHaveBeenCalled();
      expect(result.message).toContain("Updated 2 letter(s)");
    });

    it("should update linked application_questions with new ai_chats reference", async () => {
      (db.query.ai_chats.findFirst as any).mockResolvedValueOnce(mockParentAiChat);

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      (db.query.application_letters.findMany as any).mockResolvedValueOnce([]);
      // Simulate 1 linked question
      (db.query.application_questions.findMany as any).mockResolvedValueOnce([{ id: 20 }]);

      const result = await createFollowupAiChat(1, "Refine");

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
      expect(result.message).toContain("Updated 0 letter(s) and 1 question(s)");
    });

    it("should update both letters and questions if linked", async () => {
      (db.query.ai_chats.findFirst as any).mockResolvedValueOnce(mockParentAiChat);

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      (db.query.application_letters.findMany as any).mockResolvedValueOnce([{ id: 10 }]);
      (db.query.application_questions.findMany as any).mockResolvedValueOnce([{ id: 20 }, { id: 21 }]);

      const result = await createFollowupAiChat(1, "Refine");

      expect(result.success).toBe(true);
      expect(result.message).toContain("Updated 1 letter(s) and 2 question(s)");
    });

    it("should not mention updates if no linked records", async () => {
      (db.query.ai_chats.findFirst as any).mockResolvedValueOnce(mockParentAiChat);

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      (db.query.application_letters.findMany as any).mockResolvedValueOnce([]);
      (db.query.application_questions.findMany as any).mockResolvedValueOnce([]);

      const result = await createFollowupAiChat(1, "Refine");

      expect(result.success).toBe(true);
      expect(result.message).toBe(
        "Follow-up ai_chats created successfully (ID: 2)",
      );
    });
  });

  describe("error handling", () => {
    it("should handle createAndGenerateAiChat failure", async () => {
      (db.query.ai_chats.findFirst as any).mockResolvedValueOnce(mockParentAiChat);

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: false,
        message: "Groq API error",
      });

      const result = await createFollowupAiChat(1, "Refine");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Groq API error");
    });

    it("should handle database errors", async () => {
      (db.query.ai_chats.findFirst as any).mockRejectedValueOnce(
        new Error("Database connection failed"),
      );

      const result = await createFollowupAiChat(1, "Refine");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Database connection failed");
    });

    it("should handle unknown errors", async () => {
      (db.query.ai_chats.findFirst as any).mockRejectedValueOnce("Unexpected error");

      const result = await createFollowupAiChat(1, "Refine");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Unknown error");
    });
  });

  describe("return values", () => {
    it("should return created aiChat on success", async () => {
      (db.query.ai_chats.findFirst as any).mockResolvedValueOnce(mockParentAiChat);

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      (db.query.application_letters.findMany as any).mockResolvedValueOnce([]);
      (db.query.application_questions.findMany as any).mockResolvedValueOnce([]);

      const result = await createFollowupAiChat(1, "Refine");

      expect(result.success).toBe(true);
      expect(result.aiChat).toBeDefined();
      expect(result.aiChat?.id).toBe(2);
      expect(result.aiChat?.profile_id).toBe(123);
    });

    it("should not return aiChat on failure", async () => {
      (db.query.ai_chats.findFirst as any).mockResolvedValueOnce(null);

      const result = await createFollowupAiChat(999, "Refine");

      expect(result.success).toBe(false);
      expect(result.aiChat).toBeUndefined();
    });
  });
});
