/**
 * Unit tests for webhook ai_chat.generate_full_prompt event handler
 * Tests secret verification, event routing, full prompt generation, and error handling
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebhookPayload } from "$lib/types/webhook";

// Mock the prisma module
vi.mock("$lib/db", () => ({
  prisma: {
    ai_chat: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock the get-env utility
vi.mock("$lib/tools/get-env", () => ({
  getEnv: vi.fn((key: string, defaultValue = "") => {
    const envVars: Record<string, string> = {
      WEBHOOK_SECRET: "test-webhook-secret-key-1234567890123456",
    };
    return envVars[key] ?? defaultValue;
  }),
}));

import { prisma } from "$lib/db";
import { POST } from "../+server";

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
  } as any;
}

describe("POST /api/webhook - ai_chat.generate_full_prompt event", () => {
  const secret = "test-webhook-secret-key-1234567890123456";
  const validPayload: WebhookPayload = {
    eventType: "ai_chat.generate_full_prompt",
    data: {
      aiChatIds: ["1", "2", "3"],
    },
  };
  const singleAiChatPayload: WebhookPayload = {
    eventType: "ai_chat.generate_full_prompt",
    data: {
      aiChatIds: ["1"],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("secret verification", () => {
    it("should reject requests with missing secret header", async () => {
      const request = new Request("http://localhost:5173/api/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validPayload),
      });

      const event = createMockEvent(request);
      const response = await POST(event);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Missing webhook secret header");
    });

    it("should reject requests with invalid secret", async () => {
      const request = createMockRequest(validPayload, "invalid-secret-key");
      const event = createMockEvent(request);
      const response = await POST(event);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid webhook secret");
    });

    it("should accept requests with valid secret", async () => {
      const request = createMockRequest(validPayload, secret);
      const event = createMockEvent(request);

      // Mock successful ai_chat queries
      const mockPrisma = prisma as any;
      mockPrisma.ai_chat.findUnique.mockResolvedValueOnce({
        id: 1,
        system_prompt: "System prompt 1",
        user_prompt: "User prompt 1",
      });
      mockPrisma.ai_chat.update.mockResolvedValueOnce({
        id: 1,
        full_prompt: "System prompt 1\n\nUser prompt 1",
      });

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe("payload validation", () => {
    it("should reject invalid JSON payload", async () => {
      const invalidBody = "invalid json {";

      const request = new Request("http://localhost:5173/api/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": secret,
        },
        body: invalidBody,
      });

      const event = createMockEvent(request);
      const response = await POST(event);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to parse request body as JSON");
    });

    it("should reject payload missing required fields", async () => {
      const incompletePayload = {
        eventType: "ai_chat.generate_full_prompt",
        // missing data field
      };

      const request = createMockRequest(incompletePayload as any, secret);
      const event = createMockEvent(request);

      const response = await POST(event);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Missing required fields");
    });

    it("should reject payload with invalid aiChatIds type (not an array)", async () => {
      const payloadInvalidAiChatIds: WebhookPayload = {
        eventType: "ai_chat.generate_full_prompt",
        data: {
          aiChatIds: "not-an-array",
        },
      };

      const request = createMockRequest(payloadInvalidAiChatIds, secret);
      const event = createMockEvent(request);

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(false);
      expect(data.data.error).toContain("Missing or invalid aiChatIds");
    });

    it("should reject payload with missing aiChatIds", async () => {
      const payloadNoAiChatIds: WebhookPayload = {
        eventType: "ai_chat.generate_full_prompt",
        data: {
          // missing aiChatIds
        },
      };

      const request = createMockRequest(payloadNoAiChatIds, secret);
      const event = createMockEvent(request);

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(false);
      expect(data.data.error).toContain("Missing or invalid aiChatIds");
    });
  });

  describe("ai_chat.generate_full_prompt event processing", () => {
    it(
      "should successfully process valid ai_chat.generate_full_prompt event with multiple AI chats",
      async () => {
        const request = createMockRequest(validPayload, secret);
        const event = createMockEvent(request);

        const mockPrisma = prisma as any;
        mockPrisma.ai_chat.findUnique
          .mockResolvedValueOnce({
            id: 1,
            system_prompt: "System 1",
            user_prompt: "User 1",
          })
          .mockResolvedValueOnce({
            id: 2,
            system_prompt: "System 2",
            user_prompt: "User 2",
          })
          .mockResolvedValueOnce({
            id: 3,
            system_prompt: "System 3",
            user_prompt: "User 3",
          });

        mockPrisma.ai_chat.update
          .mockResolvedValueOnce({
            id: 1,
            full_prompt: "System 1\n\nUser 1",
          })
          .mockResolvedValueOnce({
            id: 2,
            full_prompt: "System 2\n\nUser 2",
          })
          .mockResolvedValueOnce({
            id: 3,
            full_prompt: "System 3\n\nUser 3",
          });

        const response = await POST(event);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.processed).toBe(true);
        expect(data.data.aiChatCount).toBe(3);
        expect(data.data.successCount).toBe(3);
        expect(data.data.results).toHaveLength(3);
        expect(mockPrisma.ai_chat.findUnique).toHaveBeenCalledTimes(3);
        expect(mockPrisma.ai_chat.update).toHaveBeenCalledTimes(3);
      },
    );

    it(
      "should combine system_prompt and user_prompt with exactly 2 newlines",
      async () => {
        const request = createMockRequest(singleAiChatPayload, secret);
        const event = createMockEvent(request);

        const mockPrisma = prisma as any;
        mockPrisma.ai_chat.findUnique.mockResolvedValueOnce({
          id: 1,
          system_prompt: "This is the system prompt",
          user_prompt: "This is the user prompt",
        });

        mockPrisma.ai_chat.update.mockResolvedValueOnce({
          id: 1,
          full_prompt: "This is the system prompt\n\nThis is the user prompt",
        });

        const response = await POST(event);

        expect(response.status).toBe(200);
        const data = await response.json();

        // Verify the update call was made with the correct full_prompt format
        expect(mockPrisma.ai_chat.update).toHaveBeenCalledWith({
          where: { id: 1 },
          data: {
            full_prompt: "This is the system prompt\n\nThis is the user prompt",
          },
        });
      },
    );

    it("should handle single aiChatId", async () => {
      const request = createMockRequest(singleAiChatPayload, secret);
      const event = createMockEvent(request);

      const mockPrisma = prisma as any;
      mockPrisma.ai_chat.findUnique.mockResolvedValueOnce({
        id: 1,
        system_prompt: "System prompt",
        user_prompt: "User prompt",
      });
      mockPrisma.ai_chat.update.mockResolvedValueOnce({
        id: 1,
        full_prompt: "System prompt\n\nUser prompt",
      });

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.processed).toBe(true);
      expect(data.data.aiChatCount).toBe(1);
      expect(data.data.successCount).toBe(1);
      expect(mockPrisma.ai_chat.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true, system_prompt: true, user_prompt: true },
      });
    });

    it("should handle AI chat not found error gracefully", async () => {
      const request = createMockRequest(singleAiChatPayload, secret);
      const event = createMockEvent(request);

      const mockPrisma = prisma as any;
      mockPrisma.ai_chat.findUnique.mockResolvedValueOnce(null);

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(false);
      expect(data.data.successCount).toBe(0);
      expect(data.data.failureCount).toBe(1);
      expect(data.data.results[0].success).toBe(false);
      expect(data.data.results[0].message).toContain("not found");
    });

    it("should handle partial failures in AI chat generation", async () => {
      const request = createMockRequest(validPayload, secret);
      const event = createMockEvent(request);

      const mockPrisma = prisma as any;
      // First one succeeds
      mockPrisma.ai_chat.findUnique
        .mockResolvedValueOnce({
          id: 1,
          system_prompt: "System 1",
          user_prompt: "User 1",
        });

      // Second one returns null (not found)
      mockPrisma.ai_chat.findUnique
        .mockResolvedValueOnce(null);

      // Third one succeeds
      mockPrisma.ai_chat.findUnique
        .mockResolvedValueOnce({
          id: 3,
          system_prompt: "System 3",
          user_prompt: "User 3",
        });

      mockPrisma.ai_chat.update
        .mockResolvedValueOnce({
          id: 1,
          full_prompt: "System 1\n\nUser 1",
        })
        .mockResolvedValueOnce({
          id: 3,
          full_prompt: "System 3\n\nUser 3",
        });

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(true);
      expect(data.data.aiChatCount).toBe(3);
      expect(data.data.successCount).toBe(2);
      expect(data.data.failureCount).toBe(1);
    });

    it(
      "should return detailed generation results for multiple AI chats",
      async () => {
        const request = createMockRequest(validPayload, secret);
        const event = createMockEvent(request);

        const mockPrisma = prisma as any;
        mockPrisma.ai_chat.findUnique
          .mockResolvedValueOnce({
            id: 1,
            system_prompt: "System 1",
            user_prompt: "User 1",
          })
          .mockResolvedValueOnce({
            id: 2,
            system_prompt: "System 2",
            user_prompt: "User 2",
          })
          .mockResolvedValueOnce({
            id: 3,
            system_prompt: "System 3",
            user_prompt: "User 3",
          });

        mockPrisma.ai_chat.update
          .mockResolvedValueOnce({ id: 1 })
          .mockResolvedValueOnce({ id: 2 })
          .mockResolvedValueOnce({ id: 3 });

        const response = await POST(event);
        const data = await response.json();

        expect(data.data.results).toBeDefined();
        expect(data.data.results).toHaveLength(3);
        expect(data.data.results[0]).toHaveProperty("aiChatId");
        expect(data.data.results[0]).toHaveProperty("success");
        expect(data.data.results[0]).toHaveProperty("message");
      },
    );
  });

  describe("response format", () => {
    it("should return proper response structure on success", async () => {
      const request = createMockRequest(validPayload, secret);
      const event = createMockEvent(request);

      const mockPrisma = prisma as any;
      mockPrisma.ai_chat.findUnique
        .mockResolvedValueOnce({
          id: 1,
          system_prompt: "System 1",
          user_prompt: "User 1",
        })
        .mockResolvedValueOnce({
          id: 2,
          system_prompt: "System 2",
          user_prompt: "User 2",
        })
        .mockResolvedValueOnce({
          id: 3,
          system_prompt: "System 3",
          user_prompt: "User 3",
        });

      mockPrisma.ai_chat.update
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 })
        .mockResolvedValueOnce({ id: 3 });

      const response = await POST(event);
      const data = await response.json();

      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("message");
      expect(data).toHaveProperty("data");
      expect(data.data).toHaveProperty("processed");
      expect(data.data).toHaveProperty("aiChatCount");
      expect(data.data).toHaveProperty("successCount");
      expect(data.data).toHaveProperty("results");
    });
  });

  describe("error handling", () => {
    it("should handle all AI chats failing gracefully", async () => {
      const request = createMockRequest(validPayload, secret);
      const event = createMockEvent(request);

      const mockPrisma = prisma as any;
      mockPrisma.ai_chat.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.processed).toBe(false);
      expect(data.data.aiChatCount).toBe(3);
      expect(data.data.failureCount).toBe(3);
      expect(data.data.successCount).toBe(0);
    });

    it(
      "should handle string IDs that cannot be parsed to integers",
      async () => {
        const payloadInvalidIds: WebhookPayload = {
          eventType: "ai_chat.generate_full_prompt",
          data: {
            aiChatIds: ["abc", "def", "xyz"],
          },
        };

        const request = createMockRequest(payloadInvalidIds, secret);
        const event = createMockEvent(request);

        const response = await POST(event);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.data.processed).toBe(false);
        expect(data.data.error).toContain("Missing or invalid aiChatIds");
      },
    );

    it("should handle mixed valid and invalid string IDs", async () => {
      const payloadMixedIds: WebhookPayload = {
        eventType: "ai_chat.generate_full_prompt",
        data: {
          aiChatIds: ["1", "abc", "2"],
        },
      };

      const request = createMockRequest(payloadMixedIds, secret);
      const event = createMockEvent(request);

      const mockPrisma = prisma as any;
      mockPrisma.ai_chat.findUnique
        .mockResolvedValueOnce({
          id: 1,
          system_prompt: "System 1",
          user_prompt: "User 1",
        })
        .mockResolvedValueOnce({
          id: 2,
          system_prompt: "System 2",
          user_prompt: "User 2",
        });

      mockPrisma.ai_chat.update
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 });

      const response = await POST(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      // Should only process valid IDs (1 and 2)
      expect(data.data.aiChatCount).toBe(2);
      expect(data.data.successCount).toBe(2);
    });
  });
});
