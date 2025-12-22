/**
 * Unit tests for ai-chat-application-question-followup
 * Tests application question-specific followup creation
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database
vi.mock("$lib/db", () => ({
  db: {
    application_questions: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock the core followup creation function
vi.mock("$lib/server/ai-chat-create-followup", () => ({
  createFollowupAiChat: vi.fn(),
}));

import { db } from "$lib/db";
import { createFollowupAiChat } from "$lib/server/ai-chat-create-followup";
import { createApplicationQuestionFollowup } from "../ai-chat-application-question-followup";

describe("createApplicationQuestionFollowup", () => {
  const mockQuestion = {
    id: 200,
    ai_chat: 5,
  };

  const mockCreatedAiChat = {
    id: 6,
    profile: 456,
    system_prompt: "Refine the previous answer",
    user_prompt: "Make it more detailed",
    full_prompt: "System: Refine...\nUser: Make it more detailed",
    response: "Refined answer with more details",
    date_created: new Date(),
    date_updated: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validation", () => {
    it("should return error if application question not found", async () => {
      const mockFindUnique = db.application_questions.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(null);

      const result = await createApplicationQuestionFollowup(
        999,
        "Make it more technical",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain(
        "Application question with ID 999 not found",
      );
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 999 },
        select: {
          id: true,
          ai_chat: true,
        },
      });
    });

    it("should return error if question has no ai_chat", async () => {
      const mockFindUnique = db.application_questions.findUnique as any;
      mockFindUnique.mockResolvedValueOnce({
        id: 200,
        ai_chat: null,
      });

      const result = await createApplicationQuestionFollowup(
        200,
        "Expand the answer",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("does not have an ai_chat yet");
      expect(result.message).toContain("Generate the initial answer first");
    });
  });

  describe("successful followup creation", () => {
    it("should create followup and update question reference", async () => {
      const mockFindUnique = db.application_questions.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockQuestion);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockUpdate = db.application_questions.update as any;
      mockUpdate.mockResolvedValueOnce({});

      const result = await createApplicationQuestionFollowup(
        200,
        "Add specific examples",
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain(
        "Follow-up AI chat created successfully",
      );
      expect(result.message).toContain("ID: 6");
      expect(result.message).toContain(
        "Application question 200 has been updated",
      );
      expect(result.aiChat).toBeDefined();
      expect(result.aiChat?.id).toBe(6);

      // Verify createFollowupAiChat was called correctly
      expect(mockCreateFollowup).toHaveBeenCalledWith(
        5, // parent ai_chat id
        "Add specific examples",
        { includeOriginalContext: undefined },
      );

      // Verify question was updated
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 200 },
        data: {
          ai_chat: 6,
          ai_chat_response: "Refined answer with more details",
        },
      });
    });

    it("should pass includeOriginalContext option to createFollowupAiChat", async () => {
      const mockFindUnique = db.application_questions.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockQuestion);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockUpdate = db.application_questions.update as any;
      mockUpdate.mockResolvedValueOnce({});

      await createApplicationQuestionFollowup(
        200,
        "Make it shorter",
        true, // includeOriginalContext
      );

      expect(mockCreateFollowup).toHaveBeenCalledWith(
        5,
        "Make it shorter",
        { includeOriginalContext: true },
      );
    });

    it("should update both ai_chat and ai_chat_response fields", async () => {
      const mockFindUnique = db.application_questions.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockQuestion);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockUpdate = db.application_questions.update as any;
      mockUpdate.mockResolvedValueOnce({});

      await createApplicationQuestionFollowup(200, "Refine");

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 200 },
        data: {
          ai_chat: 6,
          ai_chat_response: "Refined answer with more details",
        },
      });
    });
  });

  describe("error handling", () => {
    it("should handle createFollowupAiChat failure", async () => {
      const mockFindUnique = db.application_questions.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockQuestion);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: false,
        message: "Parent ai_chat not found",
      });

      const result = await createApplicationQuestionFollowup(200, "Refine");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Parent ai_chat not found");
      expect(result.aiChat).toBeUndefined();

      // Question should not be updated
      const mockUpdate = db.application_questions.update as any;
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("should handle createFollowupAiChat returning no aiChat", async () => {
      const mockFindUnique = db.application_questions.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockQuestion);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: false,
        message: "Failed to create followup",
        aiChat: undefined,
      });

      const result = await createApplicationQuestionFollowup(200, "Refine");

      expect(result.success).toBe(false);

      // Question should not be updated
      const mockUpdate = db.application_questions.update as any;
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      const mockFindUnique = db.application_questions.findUnique as any;
      mockFindUnique.mockRejectedValueOnce(
        new Error("Database connection lost"),
      );

      const result = await createApplicationQuestionFollowup(200, "Refine");

      expect(result.success).toBe(false);
      expect(result.message).toContain(
        "Error creating application question follow-up",
      );
      expect(result.message).toContain("Database connection lost");
    });

    it("should handle unknown errors", async () => {
      const mockFindUnique = db.application_questions.findUnique as any;
      mockFindUnique.mockRejectedValueOnce("Unexpected error");

      const result = await createApplicationQuestionFollowup(200, "Refine");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Unknown error");
    });

    it("should handle error during question update", async () => {
      const mockFindUnique = db.application_questions.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockQuestion);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockUpdate = db.application_questions.update as any;
      mockUpdate.mockRejectedValueOnce(new Error("Update failed"));

      const result = await createApplicationQuestionFollowup(200, "Refine");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Update failed");
    });
  });

  describe("return values", () => {
    it("should return aiChat on success", async () => {
      const mockFindUnique = db.application_questions.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockQuestion);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockUpdate = db.application_questions.update as any;
      mockUpdate.mockResolvedValueOnce({});

      const result = await createApplicationQuestionFollowup(200, "Refine");

      expect(result.aiChat).toBeDefined();
      expect(result.aiChat?.id).toBe(6);
      expect(result.aiChat?.response).toBe("Refined answer with more details");
    });

    it("should not return aiChat on failure", async () => {
      const mockFindUnique = db.application_questions.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(null);

      const result = await createApplicationQuestionFollowup(999, "Refine");

      expect(result.aiChat).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty followup request", async () => {
      const mockFindUnique = db.application_questions.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockQuestion);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockUpdate = db.application_questions.update as any;
      mockUpdate.mockResolvedValueOnce({});

      // Should still work, validation is done in createFollowupAiChat
      const result = await createApplicationQuestionFollowup(200, "");

      expect(mockCreateFollowup).toHaveBeenCalledWith(
        5,
        "",
        { includeOriginalContext: undefined },
      );
    });

    it("should handle question with ai_chat = 0", async () => {
      const mockFindUnique = db.application_questions.findUnique as any;
      mockFindUnique.mockResolvedValueOnce({
        id: 200,
        ai_chat: 0,
      });

      const result = await createApplicationQuestionFollowup(200, "Refine");

      // 0 is falsy, so should be treated as no ai_chat
      expect(result.success).toBe(false);
      expect(result.message).toContain("does not have an ai_chat yet");
    });
  });
});
