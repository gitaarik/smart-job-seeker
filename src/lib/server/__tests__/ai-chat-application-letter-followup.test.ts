/**
 * Unit tests for ai-chat-application-letter-followup
 * Tests application letter-specific followup creation
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database
vi.mock("$lib/server/db", () => ({
  db: {
    application_letters: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock the core followup creation function
vi.mock("$lib/server/ai-chat/create-followup", () => ({
  createFollowupAiChat: vi.fn(),
}));

import { db } from "$lib/server/db";
import { createFollowupAiChat } from "$lib/server/ai-chat/create-followup";
import { createApplicationLetterFollowup } from "../ai-chat/application-letter-followup";

describe("createApplicationLetterFollowup", () => {
  const mockLetter = {
    id: 100,
    ai_chat: 1,
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
    it("should return error if application letter not found", async () => {
      const mockFindUnique = db.application_letters.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(null);

      const result = await createApplicationLetterFollowup(
        999,
        "Make it more professional",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain(
        "Application letter with ID 999 not found",
      );
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 999 },
        select: {
          id: true,
          ai_chat: true,
        },
      });
    });

    it("should return error if letter has no ai_chats", async () => {
      const mockFindUnique = db.application_letters.findUnique as any;
      mockFindUnique.mockResolvedValueOnce({
        id: 100,
        ai_chat: null,
      });

      const result = await createApplicationLetterFollowup(
        100,
        "Make it better",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("does not have an ai_chats yet");
      expect(result.message).toContain("Generate the initial letter first");
    });
  });

  describe("successful followup creation", () => {
    it("should create followup and update letter reference", async () => {
      const mockFindUnique = db.application_letters.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockLetter);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockUpdate = db.application_letters.update as any;
      mockUpdate.mockResolvedValueOnce({});

      const result = await createApplicationLetterFollowup(
        100,
        "Make it more concise",
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain(
        "Follow-up AI chat created successfully",
      );
      expect(result.message).toContain("ID: 2");
      expect(result.message).toContain(
        "Application letter 100 has been updated",
      );
      expect(result.aiChat).toBeDefined();
      expect(result.aiChat?.id).toBe(2);

      // Verify createFollowupAiChat was called correctly
      expect(mockCreateFollowup).toHaveBeenCalledWith(
        1, // parent ai_chats id
        "Make it more concise",
        expect.objectContaining({ includeOriginalContext: undefined, profileDataFields: expect.any(Array) }),
      );

      // Verify letter was updated
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 100 },
        data: {
          ai_chat: 2,
          ai_chat_response: "Refined response",
        },
      });
    });

    it("should pass includeOriginalContext option to createFollowupAiChat", async () => {
      const mockFindUnique = db.application_letters.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockLetter);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockUpdate = db.application_letters.update as any;
      mockUpdate.mockResolvedValueOnce({});

      await createApplicationLetterFollowup(
        100,
        "Add more details",
        true, // includeOriginalContext
      );

      expect(mockCreateFollowup).toHaveBeenCalledWith(
        1,
        "Add more details",
        expect.objectContaining({ includeOriginalContext: true, profileDataFields: expect.any(Array) }),
      );
    });

    it("should update both ai_chats and ai_chat_response fields", async () => {
      const mockFindUnique = db.application_letters.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockLetter);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockUpdate = db.application_letters.update as any;
      mockUpdate.mockResolvedValueOnce({});

      await createApplicationLetterFollowup(100, "Refine");

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 100 },
        data: {
          ai_chat: 2,
          ai_chat_response: "Refined response",
        },
      });
    });
  });

  describe("error handling", () => {
    it("should handle createFollowupAiChat failure", async () => {
      const mockFindUnique = db.application_letters.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockLetter);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: false,
        message: "Parent ai_chats does not have a response yet",
      });

      const result = await createApplicationLetterFollowup(100, "Refine");

      expect(result.success).toBe(false);
      expect(result.message).toBe(
        "Parent ai_chats does not have a response yet",
      );
      expect(result.aiChat).toBeUndefined();

      // Letter should not be updated
      const mockUpdate = db.application_letters.update as any;
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("should handle createFollowupAiChat returning no aiChat", async () => {
      const mockFindUnique = db.application_letters.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockLetter);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: false,
        message: "Failed to create followup",
        aiChat: undefined,
      });

      const result = await createApplicationLetterFollowup(100, "Refine");

      expect(result.success).toBe(false);

      // Letter should not be updated
      const mockUpdate = db.application_letters.update as any;
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      const mockFindUnique = db.application_letters.findUnique as any;
      mockFindUnique.mockRejectedValueOnce(
        new Error("Database connection failed"),
      );

      const result = await createApplicationLetterFollowup(100, "Refine");

      expect(result.success).toBe(false);
      expect(result.message).toContain(
        "Error creating application letter follow-up",
      );
      expect(result.message).toContain("Database connection failed");
    });

    it("should handle unknown errors", async () => {
      const mockFindUnique = db.application_letters.findUnique as any;
      mockFindUnique.mockRejectedValueOnce("Unexpected error");

      const result = await createApplicationLetterFollowup(100, "Refine");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Unknown error");
    });

    it("should handle error during letter update", async () => {
      const mockFindUnique = db.application_letters.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockLetter);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockUpdate = db.application_letters.update as any;
      mockUpdate.mockRejectedValueOnce(new Error("Update failed"));

      const result = await createApplicationLetterFollowup(100, "Refine");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Update failed");
    });
  });

  describe("return values", () => {
    it("should return aiChat on success", async () => {
      const mockFindUnique = db.application_letters.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockLetter);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockUpdate = db.application_letters.update as any;
      mockUpdate.mockResolvedValueOnce({});

      const result = await createApplicationLetterFollowup(100, "Refine");

      expect(result.aiChat).toBeDefined();
      expect(result.aiChat?.id).toBe(2);
      expect(result.aiChat?.response).toBe("Refined response");
    });

    it("should not return aiChat on failure", async () => {
      const mockFindUnique = db.application_letters.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(null);

      const result = await createApplicationLetterFollowup(999, "Refine");

      expect(result.aiChat).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty followup request", async () => {
      const mockFindUnique = db.application_letters.findUnique as any;
      mockFindUnique.mockResolvedValueOnce(mockLetter);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const mockUpdate = db.application_letters.update as any;
      mockUpdate.mockResolvedValueOnce({});

      // Should still work, validation is done in createFollowupAiChat
      const result = await createApplicationLetterFollowup(100, "");

      expect(mockCreateFollowup).toHaveBeenCalledWith(
        1,
        "",
        expect.objectContaining({ includeOriginalContext: undefined, profileDataFields: expect.any(Array) }),
      );
    });

    it("should handle letter with ai_chats = 0", async () => {
      const mockFindUnique = db.application_letters.findUnique as any;
      mockFindUnique.mockResolvedValueOnce({
        id: 100,
        ai_chat: 0,
      });

      const result = await createApplicationLetterFollowup(100, "Refine");

      // 0 is falsy, so should be treated as no ai_chats
      expect(result.success).toBe(false);
      expect(result.message).toContain("does not have an ai_chats yet");
    });
  });
});
