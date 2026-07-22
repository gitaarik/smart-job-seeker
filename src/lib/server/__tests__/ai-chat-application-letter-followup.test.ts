/**
 * Unit tests for ai-chat-application-letter-followup
 * Tests application letter-specific followup creation
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Drizzle update chain
const mockUpdateWhere = vi.fn().mockResolvedValue({});
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdateFn = vi.fn().mockReturnValue({ set: mockUpdateSet });

// Mock Drizzle insert chain
const mockInsertValues = vi.fn().mockResolvedValue({});
const mockInsertFn = vi.fn().mockReturnValue({ values: mockInsertValues });

// Mock the database with Drizzle-style API
vi.mock("$lib/server/db", () => ({
  db: {
    query: {
      application_letters: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      letter_versions: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
    update: (...args: any[]) => mockUpdateFn(...args),
    insert: (...args: any[]) => mockInsertFn(...args),
  },
}));

// Mock the core followup creation function
vi.mock("$lib/server/ai-chat/create-followup", () => ({
  createFollowupAiChat: vi.fn(),
}));

// The shared version engine writes via dbDirect (not mocked here); stub it so
// the updateEntity callback's recordVersion is a no-op. Its own behavior is
// covered by entity-versions.test.ts.
vi.mock("$lib/server/ai-chat/entity-versions", () => ({
  LETTER_VERSIONS: { fkName: "letter" },
  recordVersion: vi.fn().mockResolvedValue(undefined),
  ensureBaselineVersion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: any, val: any) => val),
  and: vi.fn((...args: any[]) => args),
  or: vi.fn((...args: any[]) => args),
  isNotNull: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
}));

vi.mock("$lib/server/db/schema", () => ({
  application_letters: {
    id: "application_letters.id",
    ai_chat_id: "application_letters.ai_chat_id",
    letter_type: "application_letters.letter_type",
    content: "application_letters.content",
  },
  letter_versions: {
    letter: "letter_versions.letter",
    id: "letter_versions.id",
    user_request: "letter_versions.user_request",
    ai_feedback: "letter_versions.ai_feedback",
    content: "letter_versions.content",
  },
}));

import { db } from "$lib/server/db";
import { createFollowupAiChat } from "$lib/server/ai-chat/create-followup";
import { createApplicationLetterFollowup } from "../ai-chat/application-letter-followup";

describe("createApplicationLetterFollowup", () => {
  const mockLetter = {
    id: 100,
    ai_chat_id: 1,
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
    mockInsertValues.mockResolvedValue({});
  });

  describe("validation", () => {
    it("should return error if application letter not found", async () => {
      (db.query.application_letters.findFirst as any).mockResolvedValueOnce(
        null,
      );

      const result = await createApplicationLetterFollowup(
        999,
        "Make it more professional",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain(
        "Application letter with ID 999 not found",
      );
      expect(db.query.application_letters.findFirst).toHaveBeenCalled();
    });

    it("should return error if letter has no ai_chats", async () => {
      (db.query.application_letters.findFirst as any).mockResolvedValueOnce({
        id: 100,
        ai_chat_id: null,
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
      (db.query.application_letters.findFirst as any).mockResolvedValueOnce(
        mockLetter,
      );

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

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
        expect.objectContaining({
          includeOriginalContext: undefined,
          profileDataFields: expect.any(Array),
        }),
      );

      // Verify letter was updated via Drizzle update chain
      expect(mockUpdateFn).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ai_chat_id: 2,
          ai_chat_response: "Refined response",
        }),
      );
    });

    it("should pass includeOriginalContext option to createFollowupAiChat", async () => {
      (db.query.application_letters.findFirst as any).mockResolvedValueOnce(
        mockLetter,
      );

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      await createApplicationLetterFollowup(
        100,
        "Add more details",
        true, // includeOriginalContext
      );

      expect(mockCreateFollowup).toHaveBeenCalledWith(
        1,
        "Add more details",
        expect.objectContaining({
          includeOriginalContext: true,
          profileDataFields: expect.any(Array),
        }),
      );
    });

    it("should update both ai_chats and ai_chat_response fields", async () => {
      (db.query.application_letters.findFirst as any).mockResolvedValueOnce(
        mockLetter,
      );

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      await createApplicationLetterFollowup(100, "Refine");

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ai_chat_id: 2,
          ai_chat_response: "Refined response",
        }),
      );
    });
  });

  describe("error handling", () => {
    it("should handle createFollowupAiChat failure", async () => {
      (db.query.application_letters.findFirst as any).mockResolvedValueOnce(
        mockLetter,
      );

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
      expect(mockUpdateFn).not.toHaveBeenCalled();
    });

    it("should handle createFollowupAiChat returning no aiChat", async () => {
      (db.query.application_letters.findFirst as any).mockResolvedValueOnce(
        mockLetter,
      );

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: false,
        message: "Failed to create followup",
        aiChat: undefined,
      });

      const result = await createApplicationLetterFollowup(100, "Refine");

      expect(result.success).toBe(false);

      // Letter should not be updated
      expect(mockUpdateFn).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      (db.query.application_letters.findFirst as any).mockRejectedValueOnce(
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
      (db.query.application_letters.findFirst as any).mockRejectedValueOnce(
        "Unexpected error",
      );

      const result = await createApplicationLetterFollowup(100, "Refine");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Unknown error");
    });

    it("should handle error during letter update", async () => {
      (db.query.application_letters.findFirst as any).mockResolvedValueOnce(
        mockLetter,
      );

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      mockUpdateWhere.mockRejectedValueOnce(new Error("Update failed"));

      const result = await createApplicationLetterFollowup(100, "Refine");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Update failed");
    });
  });

  describe("return values", () => {
    it("should return aiChat on success", async () => {
      (db.query.application_letters.findFirst as any).mockResolvedValueOnce(
        mockLetter,
      );

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const result = await createApplicationLetterFollowup(100, "Refine");

      expect(result.aiChat).toBeDefined();
      expect(result.aiChat?.id).toBe(2);
      expect(result.aiChat?.response).toBe("Refined response");
    });

    it("should not return aiChat on failure", async () => {
      (db.query.application_letters.findFirst as any).mockResolvedValueOnce(
        null,
      );

      const result = await createApplicationLetterFollowup(999, "Refine");

      expect(result.aiChat).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty followup request", async () => {
      (db.query.application_letters.findFirst as any).mockResolvedValueOnce(
        mockLetter,
      );

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      // Should still work, validation is done in createFollowupAiChat
      const result = await createApplicationLetterFollowup(100, "");

      expect(mockCreateFollowup).toHaveBeenCalledWith(
        1,
        "",
        expect.objectContaining({
          includeOriginalContext: undefined,
          profileDataFields: expect.any(Array),
        }),
      );
    });

    it("should handle letter with ai_chats = 0", async () => {
      (db.query.application_letters.findFirst as any).mockResolvedValueOnce({
        id: 100,
        ai_chat_id: 0,
      });

      const result = await createApplicationLetterFollowup(100, "Refine");

      // 0 is falsy, so should be treated as no ai_chats
      expect(result.success).toBe(false);
      expect(result.message).toContain("does not have an ai_chats yet");
    });
  });
});
