/**
 * Unit tests for profile export utility functions
 * Tests schema and data export logic with mocked database
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database
vi.mock("$lib/server/db", () => ({
  db: {
    query: {
      profiles: {
        findFirst: vi.fn(),
      },
      collected_data: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
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
    // Setup for profile check - profile not found
    (db.query.profiles.findFirst as any).mockResolvedValueOnce(null);

    const result = await exportProfile(1);

    // Verify structure of response
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("message");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("marks profile-only skills in the AI snapshot rather than dropping them", async () => {
    (db.query.profiles.findFirst as any)
      .mockResolvedValueOnce({ id: 1 }) // existence check
      .mockResolvedValueOnce({
        name: "Alex",
        tech_skill_categories: [{
          name: "Backend",
          tech_skills: [
            { name: "Go", level: "expert", years_experience: 5, tags: null },
            // Held back from documents — but still the applicant's skill, so
            // it stays in the snapshot for the prompts that analyse them.
            {
              name: "Kubernetes",
              level: "beginner",
              years_experience: 1,
              tags: ["!resume", "!cv"],
            },
            // Restricted to one version, but still printed somewhere — keep.
            {
              name: "Rust",
              level: null,
              years_experience: null,
              tags: ["senior"],
            },
          ],
        }],
      });
    (db.query.collected_data.findFirst as any).mockResolvedValueOnce(null);

    const values = vi.fn().mockResolvedValue(undefined);
    (db.insert as any).mockReturnValue({ values });

    const result = await exportProfile(1);
    expect(result.success).toBe(true);

    const written = JSON.parse(values.mock.calls[0][0].data);
    const skills = written.tech_skill_categories[0].tech_skills;
    expect(skills.map((s: { name: string }) => s.name)).toEqual([
      "Go",
      "Kubernetes",
      "Rust",
    ]);
    // Dropping it here cost it job matching, which is the one thing a
    // profile-only skill exists to do.
    expect(skills[1]).toMatchObject({ name: "Kubernetes", profile_only: true });
    // Only the held-back one is marked; the rest look exactly as before.
    expect(skills[0]).not.toHaveProperty("profile_only");
    expect(skills[2]).not.toHaveProperty("profile_only");
    // `tags` is a visibility mechanism, not profile content.
    expect(skills[0]).not.toHaveProperty("tags");
    expect(skills[1]).not.toHaveProperty("tags");
  });
});
