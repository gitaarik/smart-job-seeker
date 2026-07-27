/**
 * Tests for the `updateDescription` form action.
 *
 * Covers the edit permission gate (manual jobs, owned or staff), the empty
 * guard, and — the point of the feature — that the edited text is mirrored
 * into `source_html_stripped`, which re-parse reads in preference to
 * `job_description`. Without that mirror a "Save & re-parse" would re-read the
 * stale capture and silently ignore the edit.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockJobFindFirst = vi.fn();
const mockImporterFindFirst = vi.fn();
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });
const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });
const mockGetSelectedProfileId = vi.fn();
const mockParseJobDescription = vi.fn();
const mockTriggerMatchForImport = vi.fn().mockResolvedValue(undefined);

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    query: {
      jobs: { findFirst: (...a: any[]) => mockJobFindFirst(...a) },
      job_importers: {
        findFirst: (...a: any[]) => mockImporterFindFirst(...a),
      },
    },
    update: (...a: any[]) => mockUpdate(...a),
    delete: (...a: any[]) => mockDelete(...a),
  },
  queryRaw: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c: any, v: any) => v),
  and: vi.fn((...a: any[]) => a),
  asc: vi.fn((c: any) => c),
  desc: vi.fn((c: any) => c),
  isNotNull: vi.fn((c: any) => c),
}));

vi.mock("$lib/server/db/schema", () => ({
  application_status_log: {},
  applications: {},
  job_importers: { job_id: "ji.job_id", profile_id: "ji.profile_id" },
  job_match_history: {},
  job_matches: { job_id: "jm.job_id", profile_id: "jm.profile_id" },
  job_statuses: {},
  jobs: { id: "jobs.id" },
  platform_credentials: {},
  profiles: {},
  search_task_run_items: {},
  search_tasks: {},
}));

vi.mock(
  "$lib/server/job/match-utils",
  () => ({ getProfileSkillLevels: vi.fn() }),
);
vi.mock("$lib/server/queue/match-queue", () => ({ addMatchJob: vi.fn() }));
vi.mock("$lib/server/browser/geo-utils", () => ({ getGeoConfig: vi.fn() }));
vi.mock("../../../profile/utils", () => ({
  getSelectedProfileId: (...a: any[]) => mockGetSelectedProfileId(...a),
}));
vi.mock("$lib/server/jobs/parse-job-description", () => ({
  parseJobDescription: (...a: any[]) => mockParseJobDescription(...a),
}));
vi.mock("$lib/server/job/match-trigger", () => ({
  triggerMatchForImport: (...a: any[]) => mockTriggerMatchForImport(...a),
}));

import { actions } from "../+page.server";

function createEvent(opts: {
  description?: string;
  reparse?: string;
  user?: any;
  params?: Record<string, string>;
} = {}) {
  const fd = new FormData();
  if (opts.description !== undefined) fd.set("description", opts.description);
  if (opts.reparse !== undefined) fd.set("reparse", opts.reparse);
  return {
    params: opts.params ?? { id: "3815" },
    locals: { user: opts.user === undefined ? { id: "user-1" } : opts.user },
    cookies: {} as any,
    request: { formData: async () => fd },
  } as any;
}

/** A parse result with only the fields the action reads back. */
function parsedStub(overrides: Record<string, unknown> = {}) {
  return {
    title: "Parsed Title",
    company: "Parsed Co",
    company_description: null,
    job_poster: null,
    location: null,
    remote: null,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    salary_period: null,
    salary_duration_weeks: null,
    job_type: null,
    experience_levels: null,
    skills_required: ["Svelte"],
    skills_preferred: null,
    responsibilities: null,
    soft_skills: null,
    date_posted: null,
    ai_chat_extraction: 1,
    ...overrides,
  };
}

describe("updateDescription action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateWhere.mockResolvedValue(undefined);
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockDeleteWhere.mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockGetSelectedProfileId.mockResolvedValue(12);
    mockJobFindFirst.mockResolvedValue({ created_manually: true });
    mockImporterFindFirst.mockResolvedValue({ job_id: 3815 });
    mockTriggerMatchForImport.mockResolvedValue(undefined);
  });

  it("rejects unauthenticated", async () => {
    const res = await actions.updateDescription!(
      createEvent({ description: "text", user: null }),
    );
    expect(res).toMatchObject({ status: 401 });
  });

  it("rejects an invalid job id", async () => {
    const res = await actions.updateDescription!(
      createEvent({ description: "text", params: { id: "abc" } }),
    );
    expect(res).toMatchObject({ status: 400 });
  });

  it("rejects a scraped job", async () => {
    mockJobFindFirst.mockResolvedValueOnce({ created_manually: false });
    const res = await actions.updateDescription!(
      createEvent({ description: "text" }),
    );
    expect(res).toMatchObject({ status: 403 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects a manual job this profile did not import", async () => {
    mockImporterFindFirst.mockResolvedValueOnce(undefined);
    const res = await actions.updateDescription!(
      createEvent({ description: "text" }),
    );
    expect(res).toMatchObject({ status: 403 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("lets staff edit a manual job they did not import", async () => {
    mockImporterFindFirst.mockResolvedValue(undefined);
    const res = await actions.updateDescription!(
      createEvent({
        description: "text",
        user: { id: "user-1", is_staff: true },
      }),
    );
    expect(res).toMatchObject({ success: true, action: "descriptionSaved" });
    // Staff short-circuit the ownership lookup entirely.
    expect(mockImporterFindFirst).not.toHaveBeenCalled();
  });

  it("rejects a blank description", async () => {
    const res = await actions.updateDescription!(
      createEvent({ description: "   " }),
    );
    expect(res).toMatchObject({ status: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("saves the trimmed description into both the description and the parse input", async () => {
    const res = await actions.updateDescription!(
      createEvent({ description: "  New description  " }),
    );
    expect(res).toMatchObject({ success: true, action: "descriptionSaved" });
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        job_description: "New description",
        source_html_stripped: "New description",
      }),
    );
    // No re-parse requested — extraction and scoring stay untouched.
    expect(mockParseJobDescription).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("re-parses the newly saved text and re-scores when asked", async () => {
    // The re-parse reads the job back; return what the save just wrote.
    mockJobFindFirst
      .mockResolvedValueOnce({ created_manually: true })
      .mockResolvedValueOnce({
        source_html_stripped: "New description",
        job_description: "New description",
        source_url: null,
        title: "Old Title",
        company: "Old Co",
      });
    mockParseJobDescription.mockResolvedValueOnce(parsedStub());

    const res = await actions.updateDescription!(
      createEvent({ description: "New description", reparse: "1" }),
    );

    expect(mockParseJobDescription).toHaveBeenCalledWith(
      "New description",
      expect.objectContaining({ profileId: 12 }),
    );
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        skills_required: ["Svelte"],
        title: "Parsed Title",
      }),
    );
    // Stale scores cleared for every profile, fresh one queued for the actor.
    expect(mockDelete).toHaveBeenCalled();
    expect(mockTriggerMatchForImport).toHaveBeenCalledWith(12, 3815);
    expect(res).toMatchObject({ success: true, action: "descriptionReparsed" });
  });

  it("reports a re-parse failure without pretending the save failed", async () => {
    mockJobFindFirst
      .mockResolvedValueOnce({ created_manually: true })
      .mockResolvedValueOnce({
        source_html_stripped: "New description",
        job_description: "New description",
        source_url: null,
        title: "Old Title",
        company: "Old Co",
      });
    mockParseJobDescription.mockResolvedValueOnce(null);

    const res = await actions.updateDescription!(
      createEvent({ description: "New description", reparse: "1" }),
    );

    expect(res).toMatchObject({ status: 502 });
    expect((res as any).data.error).toContain("Description saved");
    // The description write still happened.
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ job_description: "New description" }),
    );
  });
});
