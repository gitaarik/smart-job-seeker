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
// The scoped sources each load their own entity; mock the loaders so these
// tests exercise the registry and budgeting, not the DB.
vi.mock("../application-records", () => ({ interviewRecordsText: vi.fn() }));
vi.mock(
  "../application-documents",
  () => ({ applicationDocumentsText: vi.fn() }),
);
vi.mock("../job-context", () => ({ jobDetailsText: vi.fn() }));
// Only the DB read is mocked — the trimmer and renderer are pure, so the tests
// exercise the real ones.
vi.mock("../profile-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../profile-data")>()),
  loadProfileData: vi.fn(),
}));

import { relevantProjectsText } from "$lib/server/documents/retrieval";
import {
  relevantApplicationTextsText,
  relevantStoriesText,
} from "$lib/server/documents/content-retrieval";
import { interviewRecordsText } from "../application-records";
import { applicationDocumentsText } from "../application-documents";
import { jobDetailsText } from "../job-context";
import { loadProfileData } from "../profile-data";
import {
  assembleGenerationContext,
  fitToBudget,
  queryToJobLike,
} from "../generation-context";

const mockRelevantProjects = vi.mocked(relevantProjectsText);
const mockRelevantStories = vi.mocked(relevantStoriesText);
const mockRelevantAppTexts = vi.mocked(relevantApplicationTextsText);
const mockRecords = vi.mocked(interviewRecordsText);
const mockDocuments = vi.mocked(applicationDocumentsText);
const mockJobDetails = vi.mocked(jobDetailsText);
const mockLoadProfile = vi.mocked(loadProfileData);

beforeEach(() => {
  mockRelevantProjects.mockReset();
  mockRelevantStories.mockReset();
  mockRelevantAppTexts.mockReset();
  mockRecords.mockReset().mockResolvedValue("");
  mockDocuments.mockReset().mockResolvedValue("");
  mockJobDetails.mockReset().mockResolvedValue("");
  mockLoadProfile.mockReset().mockResolvedValue({ data: {}, schema: {} });
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
    const job = queryToJobLike({
      text: "distributed systems",
      skills: ["Kafka"],
    });
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
    // The key must exist either way — an unsupplied placeholder ships to the
    // model as the literal "${relevantProjects}". Here the retrieval did run
    // and came back empty, so the key carries the "we looked, there is none"
    // note; a source that never looked gets "" (covered below).
    mockRelevantProjects.mockResolvedValue("");
    const ctx = await assembleGenerationContext({
      profileId: 1,
      query: { text: "gardening" },
      sources: ["projects"],
    });
    expect(ctx.variables).toHaveProperty("relevantProjects");
    expect(ctx.variables.relevantProjects).toContain("nothing here");
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
      expect.objectContaining({
        job_description: "backend scaling",
        skills_required: ["Go"],
      }),
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
    mockRelevantStories.mockResolvedValue(
      "## Relevant interview stories\n1. Bar",
    );
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

  it("says so when a source rendered but lost the budget race", async () => {
    // The failure this replaces: the documents source produced eleven attached
    // emails, lost the budget race to the job description, and arrived as ""
    // — which the model read as "no documents exist" and reported to the user
    // as having no access to them at all.
    mockRelevantProjects.mockResolvedValue("P".repeat(4000));
    mockRelevantStories.mockResolvedValue("S".repeat(4000));

    const ctx = await assembleGenerationContext({
      profileId: 1,
      query: { text: "anything" },
      sources: ["projects", "stories"],
      budgetChars: 5000,
    });

    // Stories rank below projects, so stories is the one that gives way.
    expect(ctx.droppedSources).toEqual(["stories"]);
    expect(ctx.variables.relevantStories).toContain("could not be included");
    // It must not read as an absence — that is the whole point.
    expect(ctx.variables.relevantStories).not.toBe("");
    expect(ctx.variables.relevantProjects).toBe("P".repeat(4000));
    expect(ctx.usedSources).toEqual(["projects"]);
  });

  it("distinguishes a requested-and-empty source from a dropped one", async () => {
    // Three states, not two. "Empty" must not claim the material exists (that
    // is the dropped case) and must not read as "out of scope" either — an
    // empty section is what made the assistant answer "I can't access your
    // uploaded documents" on a page where it could read them and there simply
    // were none, sending the user off to look for a bug that wasn't there.
    mockRelevantProjects.mockResolvedValue("");
    mockRelevantStories.mockResolvedValue("## stories\n1. Bar");

    const ctx = await assembleGenerationContext({
      profileId: 1,
      query: { text: "anything" },
      sources: ["projects", "stories"],
    });

    expect(ctx.droppedSources).toEqual([]);
    expect(ctx.usedSources).toEqual(["stories"]);
    expect(ctx.variables.relevantProjects).toContain("nothing here");
    expect(ctx.variables.relevantProjects).toMatch(/never say you lack access/i);
    // Not the dropped wording — that would assert material that isn't there.
    expect(ctx.variables.relevantProjects).not.toContain("could not be included");
  });

  it("says nothing at all about a source that wasn't requested", async () => {
    // Out of scope is the fourth state and stays silent: the prompt's own
    // wording tells the model that absent sections don't apply to this page.
    mockRelevantStories.mockResolvedValue("## stories\n1. Bar");

    const ctx = await assembleGenerationContext({
      profileId: 1,
      query: { text: "anything" },
      sources: ["stories"],
    });

    expect(ctx.variables.applicationDocuments).toBeUndefined();
    expect(ctx.variables.relevantProjects).toBeUndefined();
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

describe("scoped sources", () => {
  const applicationRequest = {
    profileId: 1,
    entity: { type: "application" as const, id: 42 },
    sources: [
      "job",
      "application_records",
      "application_documents",
    ] as const,
  };

  it("loads the job, records and documents from the entity", async () => {
    mockJobDetails.mockResolvedValue("**Position:** Staff Engineer");
    mockRecords.mockResolvedValue("## What has already happened");
    mockDocuments.mockResolvedValue("## Attached documents");

    const ctx = await assembleGenerationContext({
      ...applicationRequest,
      sources: [...applicationRequest.sources],
    });

    expect(ctx.variables.jobDetails).toContain("Staff Engineer");
    expect(ctx.variables.interviewHistory).toContain("already happened");
    expect(ctx.variables.applicationDocuments).toContain("Attached documents");
    expect(mockJobDetails).toHaveBeenCalledWith({ applicationId: 42 });
  });

  it("needs no query — scoped sources render the entity, not a ranking", async () => {
    mockRecords.mockResolvedValue("## records");
    const ctx = await assembleGenerationContext({
      profileId: 1,
      entity: { type: "application", id: 42 },
      sources: ["application_records"],
    });
    expect(ctx.usedSources).toEqual(["application_records"]);
  });

  it("renders nothing for application sources when the entity is a job", async () => {
    // A job page has no application, so there is nothing recorded or attached.
    const ctx = await assembleGenerationContext({
      profileId: 1,
      entity: { type: "job", id: 5 },
      sources: ["job", "application_records", "application_documents"],
    });
    expect(mockRecords).not.toHaveBeenCalled();
    expect(mockDocuments).not.toHaveBeenCalled();
    expect(mockJobDetails).toHaveBeenCalledWith({ jobId: 5 });
    expect(ctx.variables.interviewHistory).toBe("");
  });

  it("passes the per-source detail knob through", async () => {
    await assembleGenerationContext({
      profileId: 1,
      entity: { type: "application", id: 42 },
      sources: ["application_records", "application_documents"],
      sourceOptions: {
        application_records: { detail: "full" },
        application_documents: { detail: "full" },
      },
    });
    expect(mockRecords).toHaveBeenCalledWith(42, "full");
    expect(mockDocuments).toHaveBeenCalledWith(42, "full");
  });

  it("defaults exclusion to the application in scope", async () => {
    mockRelevantAppTexts.mockResolvedValue("past writing");
    await assembleGenerationContext({
      profileId: 1,
      query: { text: "why do you want to work here" },
      entity: { type: "application", id: 42 },
      sources: ["application_texts"],
    });
    // You are never your own prior art — no explicit excludeApplicationId needed.
    expect(mockRelevantAppTexts).toHaveBeenCalledWith(
      1,
      expect.anything(),
      3,
      42,
    );
  });

  it("renders the profile blob as the `data` variable, under the budget", async () => {
    mockLoadProfile.mockResolvedValue({ data: { name: "Alex" }, schema: {} });
    const ctx = await assembleGenerationContext({
      profileId: 1,
      sources: ["profile"],
      profileFields: ["name"],
    });
    expect(ctx.variables.data).toBe('{"name":"Alex"}');
    expect(mockLoadProfile).toHaveBeenCalledWith(1, ["name"]);
  });

  it("reuses a preloaded profile instead of querying again", async () => {
    const ctx = await assembleGenerationContext({
      profileId: 1,
      sources: ["profile"],
      preloadedProfile: { data: { name: "Sam" }, schema: {} },
    });
    expect(mockLoadProfile).not.toHaveBeenCalled();
    expect(ctx.variables.data).toBe('{"name":"Sam"}');
  });

  it("does not charge the profile blob against the evidence budget", async () => {
    // Measured on dev, the blob runs 48–106k chars — several times any sane
    // evidence budget. If it competed, it would always win and every other
    // source would be dropped on exactly the profiles worth retrieving from.
    mockLoadProfile.mockResolvedValue({
      data: { bio: "x".repeat(5000) },
      schema: {},
    });
    mockRelevantProjects.mockResolvedValue("y".repeat(500));

    const ctx = await assembleGenerationContext({
      profileId: 1,
      query: { text: "anything" },
      sources: ["profile", "projects"],
      budgetChars: 600,
    });

    expect(ctx.usedSources.sort()).toEqual(["profile", "projects"]);
    expect(ctx.variables.relevantProjects).toHaveLength(500);
    expect(ctx.profileChars).toBeGreaterThan(5000);
  });

  it("still rations the evidence sources against each other", async () => {
    mockLoadProfile.mockResolvedValue({
      data: { bio: "x".repeat(5000) },
      schema: {},
    });
    mockJobDetails.mockResolvedValue("j".repeat(500));
    mockRelevantProjects.mockResolvedValue("y".repeat(500));

    const ctx = await assembleGenerationContext({
      profileId: 1,
      query: { text: "anything" },
      entity: { type: "application", id: 42 },
      sources: ["profile", "job", "projects"],
      budgetChars: 600,
    });

    // Only one 500-char evidence block fits; the job outranks retrieval.
    expect(ctx.usedSources.sort()).toEqual(["job", "profile"]);
    // The loser is announced rather than blanked: an empty section reads to the
    // model as "this doesn't exist", which is how the assistant came to tell a
    // user it had no access to documents it had just been handed.
    expect(ctx.droppedSources).toEqual(["projects"]);
    expect(ctx.variables.relevantProjects).toContain("could not be included");
  });
});
