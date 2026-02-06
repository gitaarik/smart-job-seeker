/**
 * Unit tests for ai-chat-create-followup
 * Tests the core followup creation functionality
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database
vi.mock("$lib/server/db", () => ({
  db: {
    ai_chats: {
      findUnique: vi.fn(),
    },
    application_letters: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    application_questions: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
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

import { db } from "$lib/server/db";
import {
  createAndGenerateAiChat,
  interpolatePrompt,
} from "$lib/server/ai-chat/utils";
import { createFollowupAiChat } from "../ai-chat/create-followup";

describe("createFollowupAiChat", () => {
  const mockParentAiChat = {
    id: 1,
    profile: 123,
    context: {
      jobTitle: "Senior Developer",
      company: "Acme Corp",
      applicationId: 456,
    },
    response: "This is the previous AI response that needs refinement.",
    system_prompt: "You are a helpful assistant. Job: ${jobTitle}",
    user_prompt: "Write a cover letter for ${company}",
  };

  const mockCreatedAiChat = {
    id: 2,
    profile: 123,
    system_prompt: "Refine the previous response",
    user_prompt: "Make it shorter",
    full_prompt: "System: Refine...\nUser: Make it shorter",
    response: "Refined response",
    date_created: new Date(),
    date_updated: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validation", () => {
    it("should return error if parent ai_chats not found", async () => {
      const mockFindUnique = db.ai_chats.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(null);

      const result = await createFollowupAiChat(
        999,
        "Make it better",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("Parent ai_chats with ID 999 not found");
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 999 },
        select: {
          profile: true,
          context: true,
          response: true,
          system_prompt: true,
          user_prompt: true,
        },
      });
    });

    it("should return error if parent has no response", async () => {
      const mockFindUnique = db.ai_chats.findUnique as any;
      mockFindUnique.mockResolvedValueOnce({
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
      const mockFindUnique = db.ai_chats.findUnique as any;
      mockFindUnique.mockResolvedValueOnce({
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
      const mockFindUnique = db.ai_chats.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockParentAiChat);

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockFindManyLetters = db.application_letters.findMany as any;
      const mockFindManyQuestions = db.application_questions.findMany as any;
      mockFindManyLetters.mockResolvedValueOnce([]);
      mockFindManyQuestions.mockResolvedValueOnce([]);

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
      );
    });

    it("should include previous response in custom variables", async () => {
      const mockFindUnique = db.ai_chats.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockParentAiChat);

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockFindManyLetters = db.application_letters.findMany as any;
      const mockFindManyQuestions = db.application_questions.findMany as any;
      mockFindManyLetters.mockResolvedValueOnce([]);
      mockFindManyQuestions.mockResolvedValueOnce([]);

      await createFollowupAiChat(1, "Make it better");

      expect(mockCreateAndGenerateAiChat).toHaveBeenCalledWith(
        expect.any(Number),
        "followup",
        expect.objectContaining({
          previousResponse:
            "This is the previous AI response that needs refinement.",
        }),
        expect.any(Number),
      );
    });
  });

  describe("followup creation with original context", () => {
    it("should interpolate original context when includeOriginalContext is true", async () => {
      const mockFindUnique = db.ai_chats.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockParentAiChat);

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockFindManyLetters = db.application_letters.findMany as any;
      const mockFindManyQuestions = db.application_questions.findMany as any;
      mockFindManyLetters.mockResolvedValueOnce([]);
      mockFindManyQuestions.mockResolvedValueOnce([]);

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

      const mockFindUnique = db.ai_chats.findUnique as any;
      mockFindUnique.mockResolvedValueOnce({
        ...mockParentAiChat,
        context: complexContext,
      });

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockFindManyLetters = db.application_letters.findMany as any;
      const mockFindManyQuestions = db.application_questions.findMany as any;
      mockFindManyLetters.mockResolvedValueOnce([]);
      mockFindManyQuestions.mockResolvedValueOnce([]);

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
      const mockFindUnique = db.ai_chats.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockParentAiChat);

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockFindManyLetters = db.application_letters.findMany as any;
      const mockUpdateManyLetters = db.application_letters.updateMany as any;
      const mockFindManyQuestions = db.application_questions.findMany as any;

      // Simulate 2 linked letters
      mockFindManyLetters.mockResolvedValueOnce([{ id: 10 }, { id: 11 }]);
      mockFindManyQuestions.mockResolvedValueOnce([]);

      const result = await createFollowupAiChat(1, "Refine");

      expect(result.success).toBe(true);
      expect(mockUpdateManyLetters).toHaveBeenCalledWith({
        where: { ai_chat: 1 },
        data: { ai_chat: 2 },
      });
      expect(result.message).toContain("Updated 2 letter(s)");
    });

    it("should update linked application_questions with new ai_chats reference", async () => {
      const mockFindUnique = db.ai_chats.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockParentAiChat);

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockFindManyLetters = db.application_letters.findMany as any;
      const mockFindManyQuestions = db.application_questions.findMany as any;
      const mockUpdateManyQuestions = db.application_questions
        .updateMany as any;

      mockFindManyLetters.mockResolvedValueOnce([]);
      // Simulate 1 linked question
      mockFindManyQuestions.mockResolvedValueOnce([{ id: 20 }]);

      const result = await createFollowupAiChat(1, "Refine");

      expect(result.success).toBe(true);
      expect(mockUpdateManyQuestions).toHaveBeenCalledWith({
        where: { ai_chat: 1 },
        data: { ai_chat: 2 },
      });
      expect(result.message).toContain("Updated 0 letter(s) and 1 question(s)");
    });

    it("should update both letters and questions if linked", async () => {
      const mockFindUnique = db.ai_chats.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockParentAiChat);

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockFindManyLetters = db.application_letters.findMany as any;
      const mockFindManyQuestions = db.application_questions.findMany as any;

      mockFindManyLetters.mockResolvedValueOnce([{ id: 10 }]);
      mockFindManyQuestions.mockResolvedValueOnce([{ id: 20 }, { id: 21 }]);

      const result = await createFollowupAiChat(1, "Refine");

      expect(result.success).toBe(true);
      expect(result.message).toContain("Updated 1 letter(s) and 2 question(s)");
    });

    it("should not mention updates if no linked records", async () => {
      const mockFindUnique = db.ai_chats.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockParentAiChat);

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockFindManyLetters = db.application_letters.findMany as any;
      const mockFindManyQuestions = db.application_questions.findMany as any;

      mockFindManyLetters.mockResolvedValueOnce([]);
      mockFindManyQuestions.mockResolvedValueOnce([]);

      const result = await createFollowupAiChat(1, "Refine");

      expect(result.success).toBe(true);
      expect(result.message).toBe(
        "Follow-up ai_chats created successfully (ID: 2)",
      );
    });
  });

  describe("error handling", () => {
    it("should handle createAndGenerateAiChat failure", async () => {
      const mockFindUnique = db.ai_chats.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockParentAiChat);

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
      const mockFindUnique = db.ai_chats.findUnique as any;
      mockFindUnique.mockRejectedValueOnce(
        new Error("Database connection failed"),
      );

      const result = await createFollowupAiChat(1, "Refine");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Database connection failed");
    });

    it("should handle unknown errors", async () => {
      const mockFindUnique = db.ai_chats.findUnique as any;
      mockFindUnique.mockRejectedValueOnce("Unexpected error");

      const result = await createFollowupAiChat(1, "Refine");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Unknown error");
    });
  });

  describe("return values", () => {
    it("should return created aiChat on success", async () => {
      const mockFindUnique = db.ai_chats.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockParentAiChat);

      const mockCreateAndGenerateAiChat = createAndGenerateAiChat as any;
      mockCreateAndGenerateAiChat.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockFindManyLetters = db.application_letters.findMany as any;
      const mockFindManyQuestions = db.application_questions.findMany as any;
      mockFindManyLetters.mockResolvedValueOnce([]);
      mockFindManyQuestions.mockResolvedValueOnce([]);

      const result = await createFollowupAiChat(1, "Refine");

      expect(result.success).toBe(true);
      expect(result.aiChat).toBeDefined();
      expect(result.aiChat?.id).toBe(2);
      expect(result.aiChat?.profile).toBe(123);
    });

    it("should not return aiChat on failure", async () => {
      const mockFindUnique = db.ai_chats.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(null);

      const result = await createFollowupAiChat(999, "Refine");

      expect(result.success).toBe(false);
      expect(result.aiChat).toBeUndefined();
    });
  });
});
