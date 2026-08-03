/**
 * Tests for the `updateDetails` and `updateDescription` form actions.
 *
 * Both share an edit permission gate (manual jobs, owned or staff) and an empty
 * guard. The description's extra concern — and the point of that feature — is
 * that the edited text is mirrored into `source_html_stripped`, which re-parse
 * reads in preference to `job_description`. Without that mirror a
 * "Save & re-parse" would re-read the stale capture and silently ignore the
 * edit.
 *
 * `updateDetails` carries the header card's fields. Its own concerns are that
 * the form is authoritative (a cleared box clears the column, which is the only
 * way to remove a wrong salary), that the taxonomy/location split matches the
 * create path, and that it leaves scoring alone.
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
const mockAddMatchJob = vi.fn().mockResolvedValue({ score: 77 });
const mockDetectPlatformId = vi.fn().mockResolvedValue(null);

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
vi.mock("$lib/server/queue/match-queue", () => ({
  addMatchJob: (...a: any[]) => mockAddMatchJob(...a),
}));
vi.mock("$lib/server/browser/geo-utils", () => ({ getGeoConfig: vi.fn() }));
vi.mock("../../../profile/utils", () => ({
  getSelectedProfileId: (...a: any[]) => mockGetSelectedProfileId(...a),
}));
vi.mock("$lib/server/jobs/parse-job-description", () => ({
  parseJobDescription: (...a: any[]) => mockParseJobDescription(...a),
}));
vi.mock("$lib/server/jobs/job-fields", async (importOriginal) => ({
  // Only the platform lookup touches the DB; the coercion helpers are pure and
  // are exactly what these tests are checking the action wires up correctly.
  ...(await importOriginal<typeof import("$lib/server/jobs/job-fields")>()),
  detectPlatformId: (...a: any[]) => mockDetectPlatformId(...a),
}));

import { actions } from "../+page.server";

/** Repeated fields (the taxonomy checkbox groups) post as arrays. */
type DetailFields = Record<string, string | string[]>;

function createEvent(opts: {
  description?: string;
  reparse?: string;
  fields?: DetailFields;
  user?: any;
  params?: Record<string, string>;
} = {}) {
  const fd = new FormData();
  if (opts.description !== undefined) fd.set("description", opts.description);
  if (opts.reparse !== undefined) fd.set("reparse", opts.reparse);
  for (const [key, value] of Object.entries(opts.fields ?? {})) {
    for (const v of Array.isArray(value) ? value : [value]) fd.append(key, v);
  }
  return {
    params: opts.params ?? { id: "3815" },
    locals: { user: opts.user === undefined ? { id: "user-1" } : opts.user },
    cookies: {} as any,
    request: { formData: async () => fd },
  } as any;
}

/** The header form as the browser posts it: every field present, blanks empty. */
function detailsForm(overrides: DetailFields = {}): DetailFields {
  return {
    title: "Senior Svelte Engineer",
    company: "",
    job_poster: "",
    office_location: "",
    source_url: "",
    date_posted: "",
    salary_min: "",
    salary_max: "",
    salary_currency: "",
    salary_period: "",
    ...overrides,
  };
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

/** Default happy path: a manual job this profile imported. */
function resetMocks() {
  vi.clearAllMocks();
  mockUpdateWhere.mockResolvedValue(undefined);
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
  mockDeleteWhere.mockResolvedValue(undefined);
  mockDelete.mockReturnValue({ where: mockDeleteWhere });
  mockGetSelectedProfileId.mockResolvedValue(12);
  mockJobFindFirst.mockResolvedValue({ created_manually: true });
  mockImporterFindFirst.mockResolvedValue({ job_id: 3815 });
  mockAddMatchJob.mockResolvedValue({ score: 77 });
  mockDetectPlatformId.mockResolvedValue(null);
}

describe("updateDetails action", () => {
  beforeEach(resetMocks);

  it("rejects unauthenticated", async () => {
    const res = await actions.updateDetails!(
      createEvent({ fields: detailsForm(), user: null }),
    );
    expect(res).toMatchObject({ status: 401 });
  });

  it("rejects a scraped job", async () => {
    mockJobFindFirst.mockResolvedValueOnce({ created_manually: false });
    const res = await actions.updateDetails!(
      createEvent({ fields: detailsForm() }),
    );
    expect(res).toMatchObject({ status: 403 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects a manual job this profile did not import", async () => {
    mockImporterFindFirst.mockResolvedValueOnce(undefined);
    const res = await actions.updateDetails!(
      createEvent({ fields: detailsForm() }),
    );
    expect(res).toMatchObject({ status: 403 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("lets staff edit a manual job they did not import", async () => {
    mockImporterFindFirst.mockResolvedValue(undefined);
    const res = await actions.updateDetails!(
      createEvent({
        fields: detailsForm(),
        user: { id: "user-1", is_staff: true },
      }),
    );
    expect(res).toMatchObject({ success: true, action: "detailsSaved" });
    // Staff short-circuit the ownership lookup entirely.
    expect(mockImporterFindFirst).not.toHaveBeenCalled();
  });

  it("rejects a blank title", async () => {
    const res = await actions.updateDetails!(
      createEvent({ fields: detailsForm({ title: "   " }) }),
    );
    expect(res).toMatchObject({ status: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects a title past the column width", async () => {
    // The browser caps this with maxlength; a direct POST would otherwise
    // reach the varchar(255) column and fail at the DB instead.
    const res = await actions.updateDetails!(
      createEvent({ fields: detailsForm({ title: "x".repeat(256) }) }),
    );
    expect(res).toMatchObject({ status: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("saves the posted fields without touching the parse input", async () => {
    const res = await actions.updateDetails!(
      createEvent({
        fields: detailsForm({
          title: "  Senior Svelte Engineer  ",
          company: "Acme Inc.",
          job_poster: "Roman",
          office_location: "Amsterdam",
          date_posted: "2026-07-30",
          salary_min: "50",
          salary_max: "150",
          salary_currency: "USD",
          salary_period: "hour",
          job_types: ["contract"],
          experience_levels: ["senior"],
        }),
      }),
    );
    expect(res).toMatchObject({
      success: true,
      action: "detailsSaved",
      title: "Senior Svelte Engineer",
    });
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Senior Svelte Engineer",
        company: "Acme Inc.",
        job_poster: "Roman",
        office_location: "Amsterdam",
        date_posted: "2026-07-30",
        salary_min: 50,
        salary_max: 150,
        salary_currency: "USD",
        salary_period: "hour",
        job_types: ["contract"],
        experience_levels: ["senior"],
      }),
    );
    // A metadata edit is not parse input — the stored content and the score are
    // left exactly as they were.
    expect(mockUpdateSet).not.toHaveBeenCalledWith(
      expect.objectContaining({ source_html_stripped: expect.anything() }),
    );
    expect(mockParseJobDescription).not.toHaveBeenCalled();
    expect(mockAddMatchJob).not.toHaveBeenCalled();
  });

  it("clears the columns whose boxes were emptied", async () => {
    // The form is authoritative, which is the only reading under which
    // "remove the salary I got wrong" works at all.
    await actions.updateDetails!(createEvent({ fields: detailsForm() }));
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        company: null,
        job_poster: null,
        office_location: null,
        source_url: null,
        date_posted: null,
        salary_min: null,
        salary_max: null,
        salary_currency: null,
        salary_period: null,
        work_location: null,
        job_types: null,
        experience_levels: null,
      }),
    );
  });

  it("folds a work arrangement typed into the location box", async () => {
    // Mirrors upsertJob and the create form: "Remote" is an arrangement, not a
    // city, so it moves rather than being lost to a location column nobody
    // filters on.
    await actions.updateDetails!(
      createEvent({ fields: detailsForm({ office_location: "Remote" }) }),
    );
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        office_location: null,
        work_location: ["remote"],
      }),
    );
  });

  it("canonicalizes a salary period alias", async () => {
    await actions.updateDetails!(
      createEvent({ fields: detailsForm({ salary_period: "yearly" }) }),
    );
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ salary_period: "year" }),
    );
  });

  it("rejects a malformed date rather than writing it", async () => {
    await actions.updateDetails!(
      createEvent({ fields: detailsForm({ date_posted: "30-07-2026" }) }),
    );
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ date_posted: null }),
    );
  });

  it("re-resolves the platform from a changed URL", async () => {
    mockDetectPlatformId.mockResolvedValueOnce(7);
    await actions.updateDetails!(
      createEvent({
        fields: detailsForm({ source_url: "https://www.linkedin.com/jobs/1" }),
      }),
    );
    expect(mockDetectPlatformId).toHaveBeenCalledWith(
      "https://www.linkedin.com/jobs/1",
    );
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ job_platform_id: 7 }),
    );
  });

  it("keeps a project duration only while the period is still a project", async () => {
    // The duration isn't on the form, so it would otherwise survive a switch to
    // an hourly rate and render "$50/hour (6 weeks)".
    mockJobFindFirst.mockResolvedValue({
      created_manually: true,
      salary_duration_weeks: 6,
    });

    await actions.updateDetails!(
      createEvent({ fields: detailsForm({ salary_period: "project" }) }),
    );
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ salary_duration_weeks: 6 }),
    );

    await actions.updateDetails!(
      createEvent({ fields: detailsForm({ salary_period: "hour" }) }),
    );
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ salary_duration_weeks: null }),
    );
  });
});

describe("updateDescription action", () => {
  beforeEach(resetMocks);

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
    // Stale scores are flagged for re-scoring, not deleted — the previous score
    // stays visible until the matcher replaces it. Other profiles pick the flag
    // up in the background.
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ rescore_requested_at: expect.any(Date) }),
    );
    expect(mockDelete).not.toHaveBeenCalled();
    // The acting profile is scored inline, not merely enqueued: the page
    // reloads straight after this and has to show the new number. Asserting on
    // addMatchJob and not on a fire-and-forget trigger is the point — the
    // trigger this replaced skipped any job that already had a match row,
    // which since we flag instead of delete is all of them.
    expect(mockAddMatchJob).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 12, jobId: 3815 }),
      expect.any(Number),
    );
    expect(res).toMatchObject({ success: true, action: "descriptionReparsed" });
  });

  it("still reports success when the inline re-score fails", async () => {
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
    mockAddMatchJob.mockRejectedValueOnce(new Error("queue timeout"));

    const res = await actions.updateDescription!(
      createEvent({ description: "New description", reparse: "1" }),
    );

    // The flag is what makes this safe to swallow: the background matcher
    // picks the job up on its next cycle, so the score is late, not lost.
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ rescore_requested_at: expect.any(Date) }),
    );
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
