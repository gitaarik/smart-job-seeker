import { beforeEach, describe, expect, it, vi } from "vitest";

// The provider reuses the shipped project↔job retriever; mock it so these tests
// exercise the provider's own logic (registry, budgeting, variable wiring)
// without a DB or an embedding call.
vi.mock("$lib/server/documents/retrieval", () => ({
  relevantProjectsText: vi.fn(),
}));
vi.mock("$lib/server/documents/content-retrieval", () => ({
  relevantStoriesText: vi.fn(),
  relevantApplicationTextsText: vi.fn(),
}));

import { relevantProjectsText } from "$lib/server/documents/retrieval";
import {
  relevantApplicationTextsText,
  relevantStoriesText,
} from "$lib/server/documents/content-retrieval";
import {
  assembleGenerationContext,
  fitToBudget,
  queryToJobLike,
} from "../generation-context";

const mockRelevantProjects = vi.mocked(relevantProjectsText);
const mockRelevantStories = vi.mocked(relevantStoriesText);
const mockRelevantAppTexts = vi.mocked(relevantApplicationTextsText);

beforeEach(() => {
  mockRelevantProjects.mockReset();
  mockRelevantStories.mockReset();
  mockRelevantAppTexts.mockReset();
});

describe("fitToBudget", () => {
  const block = (source: string, priority: number, len: number) => ({
    source: source as "projects",
    priority,
    text: "x".repeat(len),
  });

  it("keeps every block when the total fits", () => {
    const blocks = [block("projects", 10, 100), block("projects", 5, 100)];
    expect(fitToBudget(blocks, 1000)).toHaveLength(2);
  });

  it("drops whitespace-only and empty blocks", () => {
    const blocks = [
      { source: "projects" as const, priority: 10, text: "real" },
      { source: "projects" as const, priority: 5, text: "   \n " },
    ];
    const kept = fitToBudget(blocks, 1000);
    expect(kept).toHaveLength(1);
    expect(kept[0].text).toBe("real");
  });

  it("drops the lowest-priority block first when over budget", () => {
    const hi = block("projects", 20, 80);
    const lo = block("projects", 1, 80);
    const kept = fitToBudget([lo, hi], 100); // only one 80-char block fits
    expect(kept).toHaveLength(1);
    expect(kept[0].priority).toBe(20); // the high-priority one survived
  });

  it("keeps the single highest-priority block even if it alone exceeds budget", () => {
    const kept = fitToBudget([block("projects", 10, 5000)], 100);
    expect(kept).toHaveLength(1);
  });
});

describe("queryToJobLike", () => {
  it("maps text onto title (clipped) and description, skills onto skills_required", () => {
    const job = queryToJobLike({ text: "distributed systems", skills: ["Kafka"] });
    expect(job.title).toBe("distributed systems");
    expect(job.job_description).toBe("distributed systems");
    expect(job.skills_required).toEqual(["Kafka"]);
  });

  it("clips an overlong topic to 200 chars for the title but keeps it whole in the description", () => {
    const long = "a".repeat(500);
    const job = queryToJobLike({ text: long });
    expect(job.title).toHaveLength(200);
    expect(job.job_description).toHaveLength(500);
  });

  it("passes null skills through when none are given", () => {
    expect(queryToJobLike({ text: "topic" }).skills_required).toBeNull();
  });
});

describe("assembleGenerationContext", () => {
  it("gives every requested source a variable key even when it renders nothing", async () => {
    mockRelevantProjects.mockResolvedValue("");
    const ctx = await assembleGenerationContext({
      profileId: 1,
      query: { text: "gardening" },
      sources: ["projects"],
    });
    expect(ctx.variables).toHaveProperty("relevantProjects", "");
    expect(ctx.usedSources).toEqual([]);
  });

  it("fills the variable and reports the source when retrieval returns content", async () => {
    mockRelevantProjects.mockResolvedValue("## Relevant projects\n1. Foo");
    const ctx = await assembleGenerationContext({
      profileId: 1,
      query: { text: "backend scaling", skills: ["Go"] },
      sources: ["projects"],
    });
    expect(ctx.variables.relevantProjects).toContain("Relevant projects");
    expect(ctx.usedSources).toEqual(["projects"]);
    // The query was adapted to the retriever's JobLike shape.
    expect(mockRelevantProjects).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ job_description: "backend scaling", skills_required: ["Go"] }),
      3,
    );
  });

  it("skips retrieval entirely for an empty query (cost gate) and still supplies the key", async () => {
    const ctx = await assembleGenerationContext({
      profileId: 1,
      query: { text: "   " },
      sources: ["projects"],
    });
    expect(mockRelevantProjects).not.toHaveBeenCalled();
    expect(ctx.variables.relevantProjects).toBe("");
    expect(ctx.usedSources).toEqual([]);
  });

  it("honours a per-call k for the retrieval source", async () => {
    mockRelevantProjects.mockResolvedValue("blk");
    await assembleGenerationContext({
      profileId: 7,
      query: { text: "topic" },
      sources: ["projects"],
      perSourceK: 5,
    });
    expect(mockRelevantProjects).toHaveBeenCalledWith(7, expect.anything(), 5);
  });

  it("assembles multiple sources, each into its own variable", async () => {
    mockRelevantProjects.mockResolvedValue("## Relevant projects\n1. Foo");
    mockRelevantStories.mockResolvedValue("## Relevant interview stories\n1. Bar");
    const ctx = await assembleGenerationContext({
      profileId: 1,
      query: { text: "leadership under deadline" },
      sources: ["projects", "stories"],
    });
    expect(ctx.variables.relevantProjects).toContain("Relevant projects");
    expect(ctx.variables.relevantStories).toContain("interview stories");
    expect(ctx.usedSources.sort()).toEqual(["projects", "stories"]);
    // The stories source is keyed on the plain relevance query (no JobLike).
    expect(mockRelevantStories).toHaveBeenCalledWith(
      1,
      { text: "leadership under deadline" },
      3,
    );
  });

  it("skips retrieval for every source on an empty query (cost gate)", async () => {
    const ctx = await assembleGenerationContext({
      profileId: 1,
      query: { text: "  " },
      sources: ["projects", "stories"],
    });
    expect(mockRelevantProjects).not.toHaveBeenCalled();
    expect(mockRelevantStories).not.toHaveBeenCalled();
    expect(ctx.variables.relevantStories).toBe("");
    expect(ctx.usedSources).toEqual([]);
  });

  it("threads excludeApplicationId to the application_texts source", async () => {
    mockRelevantAppTexts.mockResolvedValue("## past writing\n1. Cover letter");
    const ctx = await assembleGenerationContext({
      profileId: 1,
      query: { text: "senior backend role" },
      sources: ["application_texts"],
      excludeApplicationId: 42,
    });
    expect(ctx.variables.relevantApplicationTexts).toContain("past writing");
    // The current application (42) is excluded so a letter can't retrieve itself.
    expect(mockRelevantAppTexts).toHaveBeenCalledWith(
      1,
      { text: "senior backend role" },
      3,
      42,
    );
  });
});
