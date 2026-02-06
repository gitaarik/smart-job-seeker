/**
 * Unit tests for webhook followup event handlers
 * Tests the application_letter.create_followup, application_questions.create_followup,
 * and ai_chats.create_followup webhook endpoints
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebhookPayload } from "$lib/types/webhook";

// Global mocks are configured in vitest.setup.ts (getEnv and db)

// Mock the followup functions
vi.mock("$lib/server/ai-chat/application-letter-followup", () => ({
  createApplicationLetterFollowup: vi.fn(),
}));

vi.mock("$lib/server/ai-chat/application-question-followup", () => ({
  createApplicationQuestionFollowup: vi.fn(),
}));

vi.mock("$lib/server/ai-chat/create-followup", () => ({
  createFollowupAiChat: vi.fn(),
}));

import { createApplicationLetterFollowup } from "$lib/server/ai-chat/application-letter-followup";
import { createApplicationQuestionFollowup } from "$lib/server/ai-chat/application-question-followup";
import { createFollowupAiChat } from "$lib/server/ai-chat/create-followup";
import { POST } from "../+server";
import { webhookRateLimiter } from "$lib/server/middleware/rate-limit";

/**
 * Helper function to create a mock Request
 */
function createMockRequest(
  body: Record<string, unknown>,
  secret: string,
  method = "POST",
): Request {
  const payloadString = JSON.stringify(body);
  return new Request("http://localhost:5173/api/webhook", {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": secret,
    },
    body: payloadString,
  });
}

/**
 * Helper function to create a mock RequestEvent
 */
function createMockEvent(request: Request) {
  return {
    request,
    url: new URL("http://localhost:5173/api/webhook"),
  } as any;
}

// Reset rate limiter before each test to prevent rate limit errors
beforeEach(() => {
  webhookRateLimiter.reset();
});

describe("POST /api/webhook - application_letter.create_followup event", () => {
  const secret = "test-webhook-secret-key-1234567890123456";

  const validPayload: WebhookPayload = {
    eventType: "application_letter.create_followup",
    data: {
      letterId: 100,
      followup_request: "Make it more professional",
      include_original_context: false,
    },
  };

  const mockCreatedAiChat = {
    id: 2,
    profile: 123,
    system_prompt: "Refine",
    user_prompt: "Make it professional",
    full_prompt: "Refine... Make it professional",
    response: "Refined letter",
    date_created: new Date(),
    date_updated: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validation", () => {
    it("should reject payload with missing letterId", async () => {
      const invalidPayload: WebhookPayload = {
        eventType: "application_letter.create_followup",
        data: {
          followup_request: "Make it better",
        },
      };

      const request = createMockRequest(invalidPayload, secret);
      const event = createMockEvent(request);
      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.success).toBe(false);
      expect(data.data.error).toContain("Missing or invalid letterId");
    });

    it("should reject payload with invalid letterId type", async () => {
      const invalidPayload: WebhookPayload = {
        eventType: "application_letter.create_followup",
        data: {
          letterId: "not-a-number",
          followup_request: "Make it better",
        },
      };

      const request = createMockRequest(invalidPayload, secret);
      const event = createMockEvent(request);
      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.success).toBe(false);
      expect(data.data.error).toContain("Missing or invalid letterId");
    });

    it("should reject payload with missing followup_request", async () => {
      const invalidPayload: WebhookPayload = {
        eventType: "application_letter.create_followup",
        data: {
          letterId: 100,
        },
      };

      const request = createMockRequest(invalidPayload, secret);
      const event = createMockEvent(request);
      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.success).toBe(false);
      expect(data.data.error).toContain("Missing or empty followup_request");
    });

    it("should reject payload with empty followup_request", async () => {
      const invalidPayload: WebhookPayload = {
        eventType: "application_letter.create_followup",
        data: {
          letterId: 100,
          followup_request: "   ",
        },
      };

      const request = createMockRequest(invalidPayload, secret);
      const event = createMockEvent(request);
      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.success).toBe(false);
      expect(data.data.error).toContain("Missing or empty followup_request");
    });
  });

  describe("successful followup creation", () => {
    it("should successfully create followup for application letter", async () => {
      const request = createMockRequest(validPayload, secret);
      const event = createMockEvent(request);

      const mockCreateFollowup = createApplicationLetterFollowup as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created successfully",
        aiChat: mockCreatedAiChat,
      });

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.success).toBe(true);
      expect(data.data.data.aiChatId).toBe(2);
      expect(data.data.data.letterId).toBe(100);

      expect(mockCreateFollowup).toHaveBeenCalledWith(
        100,
        "Make it more professional",
        false,
      );
    });

    it("should handle string letterId by parsing to number", async () => {
      const payloadWithStringId: WebhookPayload = {
        eventType: "application_letter.create_followup",
        data: {
          letterId: "100",
          followup_request: "Refine",
        },
      };

      const request = createMockRequest(payloadWithStringId, secret);
      const event = createMockEvent(request);

      const mockCreateFollowup = createApplicationLetterFollowup as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const response = await POST(event);

      expect(response.status).toBe(200);
      expect(mockCreateFollowup).toHaveBeenCalledWith(100, "Refine", false);
    });

    it("should pass include_original_context as true when set to 'true' string", async () => {
      const payloadWithContext: WebhookPayload = {
        eventType: "application_letter.create_followup",
        data: {
          letterId: 100,
          followup_request: "Add details",
          include_original_context: "true",
        },
      };

      const request = createMockRequest(payloadWithContext, secret);
      const event = createMockEvent(request);

      const mockCreateFollowup = createApplicationLetterFollowup as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const response = await POST(event);

      expect(response.status).toBe(200);
      expect(mockCreateFollowup).toHaveBeenCalledWith(
        100,
        "Add details",
        true,
      );
    });

    it("should pass include_original_context as true when set to boolean true", async () => {
      const payloadWithContext: WebhookPayload = {
        eventType: "application_letter.create_followup",
        data: {
          letterId: 100,
          followup_request: "Add details",
          include_original_context: true,
        },
      };

      const request = createMockRequest(payloadWithContext, secret);
      const event = createMockEvent(request);

      const mockCreateFollowup = createApplicationLetterFollowup as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const response = await POST(event);

      expect(response.status).toBe(200);
      expect(mockCreateFollowup).toHaveBeenCalledWith(
        100,
        "Add details",
        true,
      );
    });
  });

  describe("error handling", () => {
    it("should handle letter not found error", async () => {
      const request = createMockRequest(validPayload, secret);
      const event = createMockEvent(request);

      const mockCreateFollowup = createApplicationLetterFollowup as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: false,
        message: "Application letter with ID 100 not found",
      });

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.success).toBe(false);
      expect(data.data.error).toContain("Application letter with ID 100");
    });

    it("should handle exception during followup creation", async () => {
      const request = createMockRequest(validPayload, secret);
      const event = createMockEvent(request);

      const mockCreateFollowup = createApplicationLetterFollowup as any;
      mockCreateFollowup.mockRejectedValueOnce(new Error("Database error"));

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.success).toBe(false);
      expect(data.data.error).toContain("Database error");
    });
  });
});

describe(
  "POST /api/webhook - application_questions.create_followup event",
  () => {
    const secret = "test-webhook-secret-key-1234567890123456";

    const validPayload: WebhookPayload = {
      eventType: "application_questions.create_followup",
      data: {
        questionId: 200,
        followup_request: "Add more specific examples",
        include_original_context: false,
      },
    };

    const mockCreatedAiChat = {
      id: 6,
      profile: 456,
      system_prompt: "Refine",
      user_prompt: "Add examples",
      full_prompt: "Refine... Add examples",
      response: "Refined answer",
      date_created: new Date(),
      date_updated: new Date(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe("validation", () => {
      it("should reject payload with missing questionId", async () => {
        const invalidPayload: WebhookPayload = {
          eventType: "application_questions.create_followup",
          data: {
            followup_request: "Make it better",
          },
        };

        const request = createMockRequest(invalidPayload, secret);
        const event = createMockEvent(request);
        const response = await POST(event);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.data.success).toBe(false);
        expect(data.data.error).toContain("Missing or invalid questionId");
      });

      it("should reject payload with invalid questionId type", async () => {
        const invalidPayload: WebhookPayload = {
          eventType: "application_questions.create_followup",
          data: {
            questionId: "not-a-number",
            followup_request: "Make it better",
          },
        };

        const request = createMockRequest(invalidPayload, secret);
        const event = createMockEvent(request);
        const response = await POST(event);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.data.success).toBe(false);
        expect(data.data.error).toContain("Missing or invalid questionId");
      });

      it("should reject payload with missing followup_request", async () => {
        const invalidPayload: WebhookPayload = {
          eventType: "application_questions.create_followup",
          data: {
            questionId: 200,
          },
        };

        const request = createMockRequest(invalidPayload, secret);
        const event = createMockEvent(request);
        const response = await POST(event);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.data.success).toBe(false);
        expect(data.data.error).toContain("Missing or empty followup_request");
      });
    });

    describe("successful followup creation", () => {
      it("should successfully create followup for application question", async () => {
        const request = createMockRequest(validPayload, secret);
        const event = createMockEvent(request);

        const mockCreateFollowup = createApplicationQuestionFollowup as any;
        mockCreateFollowup.mockResolvedValueOnce({
          success: true,
          message: "Follow-up created successfully",
          aiChat: mockCreatedAiChat,
        });

        const response = await POST(event);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.success).toBe(true);
        expect(data.data.data.aiChatId).toBe(6);
        expect(data.data.data.questionId).toBe(200);

        expect(mockCreateFollowup).toHaveBeenCalledWith(
          200,
          "Add more specific examples",
          false,
        );
      });

      it("should handle string questionId by parsing to number", async () => {
        const payloadWithStringId: WebhookPayload = {
          eventType: "application_questions.create_followup",
          data: {
            questionId: "200",
            followup_request: "Refine",
          },
        };

        const request = createMockRequest(payloadWithStringId, secret);
        const event = createMockEvent(request);

        const mockCreateFollowup = createApplicationQuestionFollowup as any;
        mockCreateFollowup.mockResolvedValueOnce({
          success: true,
          message: "Follow-up created",
          aiChat: mockCreatedAiChat,
        });

        const response = await POST(event);

        expect(response.status).toBe(200);
        expect(mockCreateFollowup).toHaveBeenCalledWith(200, "Refine", false);
      });

      it("should handle include_original_context option", async () => {
        const payloadWithContext: WebhookPayload = {
          eventType: "application_questions.create_followup",
          data: {
            questionId: 200,
            followup_request: "Expand",
            include_original_context: true,
          },
        };

        const request = createMockRequest(payloadWithContext, secret);
        const event = createMockEvent(request);

        const mockCreateFollowup = createApplicationQuestionFollowup as any;
        mockCreateFollowup.mockResolvedValueOnce({
          success: true,
          message: "Follow-up created",
          aiChat: mockCreatedAiChat,
        });

        const response = await POST(event);

        expect(response.status).toBe(200);
        expect(mockCreateFollowup).toHaveBeenCalledWith(200, "Expand", true);
      });
    });

    describe("error handling", () => {
      it("should handle question not found error", async () => {
        const request = createMockRequest(validPayload, secret);
        const event = createMockEvent(request);

        const mockCreateFollowup = createApplicationQuestionFollowup as any;
        mockCreateFollowup.mockResolvedValueOnce({
          success: false,
          message: "Application question with ID 200 not found",
        });

        const response = await POST(event);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.data.success).toBe(false);
        expect(data.data.error).toContain("Application question with ID 200");
      });

      it("should handle exception during followup creation", async () => {
        const request = createMockRequest(validPayload, secret);
        const event = createMockEvent(request);

        const mockCreateFollowup = createApplicationQuestionFollowup as any;
        mockCreateFollowup.mockRejectedValueOnce(new Error("Database error"));

        const response = await POST(event);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.data.success).toBe(false);
        expect(data.data.error).toContain("Database error");
      });
    });
  },
);

describe("POST /api/webhook - ai_chats.create_followup event", () => {
  const secret = "test-webhook-secret-key-1234567890123456";

  const validPayload: WebhookPayload = {
    eventType: "ai_chats.create_followup",
    data: {
      keys: ["1", "2", "3"],
      followup_request: "Make it more concise",
      include_original_context: "false",
    },
  };

  const singlePayload: WebhookPayload = {
    eventType: "ai_chats.create_followup",
    data: {
      keys: ["1"],
      followup_request: "Expand this",
    },
  };

  const mockCreatedAiChat = {
    id: 10,
    profile: 789,
    system_prompt: "Refine",
    user_prompt: "Make concise",
    full_prompt: "Refine... Make concise",
    response: "Refined response",
    date_created: new Date(),
    date_updated: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validation", () => {
    it("should reject payload with missing keys", async () => {
      const invalidPayload: WebhookPayload = {
        eventType: "ai_chats.create_followup",
        data: {
          followup_request: "Refine",
        },
      };

      const request = createMockRequest(invalidPayload, secret);
      const event = createMockEvent(request);
      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(false);
      expect(data.data.error).toContain("Missing or invalid keys");
    });

    it("should reject payload with empty keys array", async () => {
      const invalidPayload: WebhookPayload = {
        eventType: "ai_chats.create_followup",
        data: {
          keys: [],
          followup_request: "Refine",
        },
      };

      const request = createMockRequest(invalidPayload, secret);
      const event = createMockEvent(request);
      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(false);
      expect(data.data.error).toContain("Missing or invalid keys");
    });

    it("should reject payload with invalid keys type", async () => {
      const invalidPayload: WebhookPayload = {
        eventType: "ai_chats.create_followup",
        data: {
          keys: "not-an-array",
          followup_request: "Refine",
        },
      };

      const request = createMockRequest(invalidPayload, secret);
      const event = createMockEvent(request);
      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(false);
      expect(data.data.error).toContain("Missing or invalid keys");
    });

    it("should reject payload with missing followup_request", async () => {
      const invalidPayload: WebhookPayload = {
        eventType: "ai_chats.create_followup",
        data: {
          keys: ["1"],
        },
      };

      const request = createMockRequest(invalidPayload, secret);
      const event = createMockEvent(request);
      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(false);
      expect(data.data.error).toContain("Missing or invalid followup_request");
    });

    it("should reject payload with empty followup_request", async () => {
      const invalidPayload: WebhookPayload = {
        eventType: "ai_chats.create_followup",
        data: {
          keys: ["1"],
          followup_request: "   ",
        },
      };

      const request = createMockRequest(invalidPayload, secret);
      const event = createMockEvent(request);
      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(false);
      expect(data.data.error).toContain("Missing or invalid followup_request");
    });
  });

  describe("successful followup creation", () => {
    it("should successfully create followup for multiple ai_chats", async () => {
      const request = createMockRequest(validPayload, secret);
      const event = createMockEvent(request);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup
        .mockResolvedValueOnce({
          success: true,
          message: "Follow-up created for ID 1",
          aiChat: { ...mockCreatedAiChat, id: 10 },
        })
        .mockResolvedValueOnce({
          success: true,
          message: "Follow-up created for ID 2",
          aiChat: { ...mockCreatedAiChat, id: 11 },
        })
        .mockResolvedValueOnce({
          success: true,
          message: "Follow-up created for ID 3",
          aiChat: { ...mockCreatedAiChat, id: 12 },
        });

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.processed).toBe(true);
      expect(data.data.parentAiChatCount).toBe(3);
      expect(data.data.successCount).toBe(3);
      expect(data.data.results).toHaveLength(3);

      expect(mockCreateFollowup).toHaveBeenCalledTimes(3);
      expect(mockCreateFollowup).toHaveBeenCalledWith(
        1,
        "Make it more concise",
        { includeOriginalContext: false },
      );
    });

    it("should handle single ai_chats", async () => {
      const request = createMockRequest(singlePayload, secret);
      const event = createMockEvent(request);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(true);
      expect(data.data.parentAiChatCount).toBe(1);
      expect(data.data.successCount).toBe(1);
    });

    it("should parse includeOriginalContext from 'true' string", async () => {
      const payloadWithContext: WebhookPayload = {
        eventType: "ai_chats.create_followup",
        data: {
          keys: ["1"],
          followup_request: "Refine",
          include_original_context: "true",
        },
      };

      const request = createMockRequest(payloadWithContext, secret);
      const event = createMockEvent(request);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const response = await POST(event);

      expect(response.status).toBe(200);
      expect(mockCreateFollowup).toHaveBeenCalledWith(1, "Refine", {
        includeOriginalContext: true,
      });
    });

    it("should handle partial failures", async () => {
      const request = createMockRequest(validPayload, secret);
      const event = createMockEvent(request);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup
        .mockResolvedValueOnce({
          success: true,
          message: "Follow-up created",
          aiChat: mockCreatedAiChat,
        })
        .mockResolvedValueOnce({
          success: false,
          message: "Parent ai_chats not found",
        })
        .mockResolvedValueOnce({
          success: true,
          message: "Follow-up created",
          aiChat: mockCreatedAiChat,
        });

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(true);
      expect(data.data.successCount).toBe(2);
      expect(data.data.failureCount).toBe(1);
    });

    it("should handle all failures", async () => {
      const request = createMockRequest(validPayload, secret);
      const event = createMockEvent(request);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup
        .mockResolvedValueOnce({
          success: false,
          message: "Error 1",
        })
        .mockResolvedValueOnce({
          success: false,
          message: "Error 2",
        })
        .mockResolvedValueOnce({
          success: false,
          message: "Error 3",
        });

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(false);
      expect(data.data.successCount).toBe(0);
      expect(data.data.failureCount).toBe(3);
    });

    it("should filter out invalid string IDs", async () => {
      const payloadWithInvalidIds: WebhookPayload = {
        eventType: "ai_chats.create_followup",
        data: {
          keys: ["1", "invalid", "2"],
          followup_request: "Refine",
        },
      };

      const request = createMockRequest(payloadWithInvalidIds, secret);
      const event = createMockEvent(request);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup
        .mockResolvedValueOnce({
          success: true,
          message: "Follow-up created",
          aiChat: mockCreatedAiChat,
        })
        .mockResolvedValueOnce({
          success: true,
          message: "Follow-up created",
          aiChat: mockCreatedAiChat,
        });

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      // Should only process valid IDs (1 and 2)
      expect(data.data.parentAiChatCount).toBe(2);
      expect(mockCreateFollowup).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    it("should handle exception during followup creation", async () => {
      const request = createMockRequest(singlePayload, secret);
      const event = createMockEvent(request);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockRejectedValueOnce(
        new Error("Unexpected error"),
      );

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(false);
      expect(data.data.results[0].success).toBe(false);
      expect(data.data.results[0].message).toContain("Unexpected error");
    });
  });

  describe("response format", () => {
    it("should return proper response structure", async () => {
      const request = createMockRequest(singlePayload, secret);
      const event = createMockEvent(request);

      const mockCreateFollowup = createFollowupAiChat as any;
      mockCreateFollowup.mockResolvedValueOnce({
        success: true,
        message: "Follow-up created",
        aiChat: mockCreatedAiChat,
      });

      const response = await POST(event);
      const data = await response.json();

      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("message");
      expect(data).toHaveProperty("data");
      expect(data.data).toHaveProperty("processed");
      expect(data.data).toHaveProperty("parentAiChatCount");
      expect(data.data).toHaveProperty("successCount");
      expect(data.data).toHaveProperty("results");
      expect(data.data.results[0]).toHaveProperty("parentAiChatId");
      expect(data.data.results[0]).toHaveProperty("success");
      expect(data.data.results[0]).toHaveProperty("message");
      expect(data.data.results[0]).toHaveProperty("newAiChatId");
    });
  });
});
