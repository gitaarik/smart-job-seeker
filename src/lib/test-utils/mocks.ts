/**
 * Common mock utilities for tests
 * Provides reusable mock functions and configurations
 */

import { vi } from "vitest";

/**
 * Creates a mock Prisma database client with common methods
 * Can be extended with additional methods as needed
 */
export function createMockDb() {
  return {
    profiles: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    ai_chat: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    ai_chat_prompts: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    collected_data: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    directus_collections: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    directus_fields: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  };
}

/**
 * Creates a mock environment variables object for testing
 */
export function createMockEnv(
  overrides: Record<string, string> = {},
): Record<string, string> {
  return {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    POSTGRES_URL: "postgresql://test:test@localhost:5432/test",
    ADMIN_URL: "http://localhost:8055",
    ADMIN_TOKEN: "test-token",
    GROQ_API_KEY: "test-groq-key",
    WEBHOOK_SECRET: "test-webhook-secret",
    TURNSTILE_SECRET: "test-turnstile-secret",
    ...overrides,
  };
}

/**
 * Creates a mock Groq SDK client
 */
export function createMockGroqClient() {
  return {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  };
}

/**
 * Creates a mock Directus client
 */
export function createMockDirectusClient() {
  return {
    request: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  };
}

/**
 * Mock response helpers for common API responses
 */
export const mockResponses = {
  success: (message: string, data?: any) => ({
    success: true,
    message,
    ...(data && { data }),
  }),
  error: (message: string, error?: string) => ({
    success: false,
    message,
    ...(error && { error }),
  }),
};

/**
 * Mock LLM completion response
 */
export function createMockLLMResponse(content: string) {
  return {
    choices: [
      {
        message: {
          content,
          role: "assistant",
        },
        finish_reason: "stop",
        index: 0,
      },
    ],
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  };
}

/**
 * Mock fetch response
 */
export function createMockFetchResponse(
  data: any,
  options: { status?: number; ok?: boolean } = {},
) {
  return {
    ok: options.ok !== undefined ? options.ok : true,
    status: options.status || 200,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    headers: new Headers(),
  };
}

/**
 * Helper to reset all mocks in a mock database
 */
export function resetMockDb(mockDb: ReturnType<typeof createMockDb>) {
  Object.values(mockDb).forEach((table) => {
    Object.values(table).forEach((method) => {
      if (typeof method === "function" && "mockClear" in method) {
        method.mockClear();
      }
    });
  });
}
