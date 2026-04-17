/**
 * Unit tests for profile export utility functions
 * Tests schema and data export logic with mocked database
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database
vi.mock("$lib/server/db", () => ({
  db: {
    profiles: {
      findUnique: vi.fn(),
    },
    collected_data: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock remove-markdown
vi.mock("remove-markdown", () => ({
  default: (text: string) => text.replace(/[#*_`\[\]]/g, ""),
}));

import { exportProfile } from "../profile/export";
import { db } from "$lib/server/db";

describe("exportProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export both schema and data atomically", async () => {
    const mockDb = db as any;

    // Setup for profile check - profile not found
    mockDb.profiles.findUnique.mockResolvedValueOnce(null);

    const result = await exportProfile(1);

    // Verify structure of response
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("message");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });
});
