/**
 * Unit tests for ai-chat-application-question-followup
 * Tests application question-specific followup creation
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Drizzle update chain
const mockUpdateWhere = vi.fn().mockResolvedValue({});
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdateFn = vi.fn().mockReturnValue({ set: mockUpdateSet });

// Mock the database with Drizzle-style API
vi.mock("$lib/server/db", () => ({
  db: {
    query: {
      application_questions: {
        findFirst: vi.fn(),
      },
    },
    update: (...args: any[]) => mockUpdateFn(...args),
  },
}));

// Mock the core followup creation function
vi.mock("$lib/server/ai-chat/create-followup", () => ({
  createFollowupAiChat: vi.fn(),
}));

// The shared version engine builds table bindings at import (and writes via
// dbDirect); stub it so the updateEntity callback's recordVersion is a no-op.
// Its own behavior is covered by entity-versions.test.ts.
vi.mock("$lib/server/ai-chat/entity-versions", () => ({
  QUESTION_VERSIONS: { fkName: "question" },
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
  application_questions: {
    id: "application_questions.id",
    ai_chat_id: "application_questions.ai_chat_id",
  },
  question_versions: {
    question: "question_versions.question",
    id: "question_versions.id",
    content: "question_versions.content",
    user_request: "question_versions.user_request",
    ai_feedback: "question_versions.ai_feedback",
  },
}));

import { db } from "$lib/server/db";
import { createFollowupAiChat } from "$lib/server/ai-chat/create-followup";
import { createApplicationQuestionFollowup } from "../ai-chat/application-question-followup";

describe("createApplicationQuestionFollowup", () => {
  const mockQuestion = {
    id: 200,
    ai_chat_id: 5,
  };

  const mockCreatedAiChat = {
    id: 6,
    profile_id: 456,
    system_prompt: "Refine the previous answer",
    user_prompt: "Make it more detailed",
    full_prompt: "System: Refine...\nUser: Make it more detailed",
    response: "Refined answer with more details",
    date_created: new Date(),
    date_updated: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateWhere.mockResolvedValue({});
  });

  describe("validation", () => {
    it("should return error if application question not found", async () => {
      (db.query.application_questions.findFirst as any).mockResolvedValueOnce(
        null,
      );

      const result = await createApplicationQuestionFollowup(
        999,
        "Make it more technical",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain(
        "Application question with ID 999 not found",
      );
      expect(db.query.application_questions.findFirst).toHaveBeenCalled();
    });

    it("should return error if question has no ai_chats", async () => {
      (db.query.application_questions.findFirst as any).mockResolvedValueOnce({
        id: 200,
        ai_chat_id: null,
      });

      const result = await createApplicationQuestionFollowup(
        200,
        "Expand the answer",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("does not have an ai_chats yet");
      expect(result.message).toContain("Generate the initial answer first");
    });
  });

  describe("successful followup creation", () => {
    it("should create followup and update question reference", async () => {
      (db.query.application_questions.findFirst as any).mockResolvedValueOnce(
        mockQuestion,
      );

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

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
        5, // parent ai_chats id
        "Add specific examples",
        expect.objectContaining({
          includeOriginalContext: undefined,
          promptType: undefined,
          customVariables: undefined,
          profileDataFields: expect.any(Array),
        }),
      );

      // Verify question was updated via Drizzle update chain. Followup turns
      // append versions; the answer column is a checkpoint set on save, so it
      // is NOT written here.
      expect(mockUpdateFn).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ai_chat_id: 6,
          ai_chat_response: "Refined answer with more details",
        }),
      );
    });

    it("should pass includeOriginalContext option to createFollowupAiChat", async () => {
      (db.query.application_questions.findFirst as any).mockResolvedValueOnce(
        mockQuestion,
      );

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      await createApplicationQuestionFollowup(
        200,
        "Make it shorter",
        true, // includeOriginalContext
      );

      expect(mockCreateFollowup).toHaveBeenCalledWith(
        5,
        "Make it shorter",
        expect.objectContaining({
          includeOriginalContext: true,
          promptType: undefined,
          customVariables: undefined,
          profileDataFields: expect.any(Array),
        }),
      );
    });

    it("should update both ai_chats and ai_chat_response fields", async () => {
      (db.query.application_questions.findFirst as any).mockResolvedValueOnce(
        mockQuestion,
      );

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      await createApplicationQuestionFollowup(200, "Refine");

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ai_chat_id: 6,
          ai_chat_response: "Refined answer with more details",
        }),
      );
    });
  });

  describe("error handling", () => {
    it("should handle createFollowupAiChat failure", async () => {
      (db.query.application_questions.findFirst as any).mockResolvedValueOnce(
        mockQuestion,
      );

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: false,
        message: "Parent ai_chats not found",
      });

      const result = await createApplicationQuestionFollowup(200, "Refine");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Parent ai_chats not found");
      expect(result.aiChat).toBeUndefined();

      // Question should not be updated
      expect(mockUpdateFn).not.toHaveBeenCalled();
    });

    it("should handle createFollowupAiChat returning no aiChat", async () => {
      (db.query.application_questions.findFirst as any).mockResolvedValueOnce(
        mockQuestion,
      );

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: false,
        message: "Failed to create followup",
        aiChat: undefined,
      });

      const result = await createApplicationQuestionFollowup(200, "Refine");

      expect(result.success).toBe(false);

      // Question should not be updated
      expect(mockUpdateFn).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      (db.query.application_questions.findFirst as any).mockRejectedValueOnce(
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
      (db.query.application_questions.findFirst as any).mockRejectedValueOnce(
        "Unexpected error",
      );

      const result = await createApplicationQuestionFollowup(200, "Refine");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Unknown error");
    });

    it("should handle error during question update", async () => {
      (db.query.application_questions.findFirst as any).mockResolvedValueOnce(
        mockQuestion,
      );

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      mockUpdateWhere.mockRejectedValueOnce(new Error("Update failed"));

      const result = await createApplicationQuestionFollowup(200, "Refine");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Update failed");
    });
  });

  describe("return values", () => {
    it("should return aiChat on success", async () => {
      (db.query.application_questions.findFirst as any).mockResolvedValueOnce(
        mockQuestion,
      );

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const result = await createApplicationQuestionFollowup(200, "Refine");

      expect(result.aiChat).toBeDefined();
      expect(result.aiChat?.id).toBe(6);
      expect(result.aiChat?.response).toBe("Refined answer with more details");
    });

    it("should not return aiChat on failure", async () => {
      (db.query.application_questions.findFirst as any).mockResolvedValueOnce(
        null,
      );

      const result = await createApplicationQuestionFollowup(999, "Refine");

      expect(result.aiChat).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty followup request", async () => {
      (db.query.application_questions.findFirst as any).mockResolvedValueOnce(
        mockQuestion,
      );

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      // Should still work, validation is done in createFollowupAiChat
      const result = await createApplicationQuestionFollowup(200, "");

      expect(mockCreateFollowup).toHaveBeenCalledWith(
        5,
        "",
        expect.objectContaining({
          includeOriginalContext: undefined,
          promptType: undefined,
          customVariables: undefined,
          profileDataFields: expect.any(Array),
        }),
      );
    });

    it("should handle question with ai_chats = 0", async () => {
      (db.query.application_questions.findFirst as any).mockResolvedValueOnce({
        id: 200,
        ai_chat_id: 0,
      });

      const result = await createApplicationQuestionFollowup(200, "Refine");

      // 0 is falsy, so should be treated as no ai_chats
      expect(result.success).toBe(false);
      expect(result.message).toContain("does not have an ai_chats yet");
    });
  });
});
