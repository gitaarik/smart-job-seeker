import { vi } from "vitest";

// Mock environment variables globally
vi.mock("$lib/tools/get-env", () => ({
  getEnv: vi.fn((key: string, defaultValue = "") => {
    const envVars: Record<string, string> = {
      WEBHOOK_SECRET: "test-webhook-secret-key-1234567890123456",
      DATABASE_URL: "postgresql://test:test@localhost/test",
      POSTGRES_URL: "postgresql://test:test@localhost/test",
    };
    return envVars[key] ?? defaultValue;
  }),
}));

// Mock the database module globally
vi.mock("$lib/db", () => ({
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
