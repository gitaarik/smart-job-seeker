import { vi } from "vitest";

// Mock environment variables globally
vi.mock("$lib/tools/get-env", () => ({
  getEnv: vi.fn((key: string, defaultValue = "") => {
    const envVars: Record<string, string> = {
      SJS_WEBHOOK_SECRET: "test-webhook-secret-key-1234567890123456",
      SJS_DATABASE_URL: "postgresql://test:test@localhost/test",
      SJS_POSTGRES_URL: "postgresql://test:test@localhost/test",
    };
    return envVars[key] ?? defaultValue;
  }),
}));

// Mock the database module globally
vi.mock("$lib/server/db", () => ({
  db: {
    ai_chat: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  dbDirect: {
    ai_chat: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));
