/**
 * Unit tests for profile import utility functions
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database with Drizzle-style API
vi.mock("$lib/server/db", () => ({
  dbDirect: {
    query: {
      profiles: {
        findMany: vi.fn(),
      },
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: any, val: any) => val),
  and: vi.fn((...args: any[]) => args),
  ne: vi.fn((_col: any, val: any) => val),
}));

vi.mock("$lib/server/db/schema", () => ({
  profiles: {
    user_id: "profiles.user_id",
    id: "profiles.id",
    name: "profiles.name",
  },
}));

import { getUniqueProfileName } from "../import-profile-json";
import { dbDirect } from "$lib/server/db";

describe("getUniqueProfileName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the base name when no duplicates exist", async () => {
    const mockDb = dbDirect as any;
    mockDb.query.profiles.findMany.mockResolvedValueOnce([
      { name: "Other Profile" },
      { name: "Another Profile" },
    ]);

    const result = await getUniqueProfileName("My Profile", "user-123");

    expect(result).toBe("My Profile");
    expect(mockDb.query.profiles.findMany).toHaveBeenCalled();
  });

  it("should append '2' when base name already exists", async () => {
    const mockDb = dbDirect as any;
    mockDb.query.profiles.findMany.mockResolvedValueOnce([
      { name: "My Profile" },
      { name: "Other Profile" },
    ]);

    const result = await getUniqueProfileName("My Profile", "user-123");

    expect(result).toBe("My Profile 2");
  });

  it("should increment suffix until unique name is found", async () => {
    const mockDb = dbDirect as any;
    mockDb.query.profiles.findMany.mockResolvedValueOnce([
      { name: "My Profile" },
      { name: "My Profile 2" },
      { name: "My Profile 3" },
    ]);

    const result = await getUniqueProfileName("My Profile", "user-123");

    expect(result).toBe("My Profile 4");
  });

  it("should handle gaps in numbering sequence", async () => {
    const mockDb = dbDirect as any;
    mockDb.query.profiles.findMany.mockResolvedValueOnce([
      { name: "My Profile" },
      { name: "My Profile 3" },
      { name: "My Profile 5" },
    ]);

    const result = await getUniqueProfileName("My Profile", "user-123");

    expect(result).toBe("My Profile 2");
  });

  it("should handle empty profile list", async () => {
    const mockDb = dbDirect as any;
    mockDb.query.profiles.findMany.mockResolvedValueOnce([]);

    const result = await getUniqueProfileName("My Profile", "user-123");

    expect(result).toBe("My Profile");
  });

  it("should handle names with special characters", async () => {
    const mockDb = dbDirect as any;
    mockDb.query.profiles.findMany.mockResolvedValueOnce([
      { name: "John's Profile (2024)" },
    ]);

    const result = await getUniqueProfileName("John's Profile (2024)", "user-123");

    expect(result).toBe("John's Profile (2024) 2");
  });
});
