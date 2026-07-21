/**
 * Tests for the `createQuestions` bulk-insert form action.
 *
 * Pure logic — no LLM involved. Covers the guards that protect the
 * `application_questions.question` NOT NULL column and the sort continuation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAppFindFirst = vi.fn();
const mockQFindFirst = vi.fn();
const mockValues = vi.fn().mockResolvedValue(undefined);
const mockReturning = vi.fn().mockResolvedValue([{ id: 99 }]);
const mockInsert = vi.fn().mockReturnValue({ values: mockValues, returning: mockReturning });
const mockGetSelectedProfileId = vi.fn();

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    query: {
      applications: { findFirst: (...a: any[]) => mockAppFindFirst(...a) },
      application_questions: { findFirst: (...a: any[]) => mockQFindFirst(...a) },
    },
    insert: (...a: any[]) => mockInsert(...a),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c: any, v: any) => v),
  and: vi.fn((...a: any[]) => a),
  desc: vi.fn((c: any) => c),
}));

vi.mock("$lib/server/db/schema", () => ({
  applications: { id: "applications.id", profile_id: "applications.profile_id" },
  application_letters: {},
  application_questions: {
    id: "aq.id",
    application_id: "aq.application_id",
    sort: "aq.sort",
  },
}));

vi.mock("$lib/server/profile/selected-profile", () => ({
  getSelectedProfileId: (...a: any[]) => mockGetSelectedProfileId(...a),
}));

import { actions } from "../+page.server";

function createEvent(questions: unknown, opts: {
  user?: any;
  params?: Record<string, string>;
  rawQuestions?: string;
} = {}) {
  const fd = new FormData();
  fd.set(
    "questions",
    opts.rawQuestions !== undefined ? opts.rawQuestions : JSON.stringify(questions),
  );
  return {
    params: opts.params ?? { id: "1" },
    locals: { user: opts.user === undefined ? { id: "user-1" } : opts.user },
    cookies: {} as any,
    request: { formData: async () => fd },
  } as any;
}

describe("createQuestions action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValues.mockResolvedValue(undefined);
    mockGetSelectedProfileId.mockResolvedValue(12);
    mockAppFindFirst.mockResolvedValue({ id: 1, profile_id: 12 });
    mockQFindFirst.mockResolvedValue({ sort: 5 });
  });

  it("rejects unauthenticated", async () => {
    const res = await actions.createQuestions!(createEvent([], { user: null }));
    expect(res).toMatchObject({ status: 401 });
  });

  it("rejects when no profile is selected", async () => {
    mockGetSelectedProfileId.mockResolvedValueOnce(null);
    const res = await actions.createQuestions!(createEvent([{ question: "Q", answer: "A" }]));
    expect(res).toMatchObject({ status: 400 });
  });

  it("rejects an invalid application id", async () => {
    const res = await actions.createQuestions!(
      createEvent([{ question: "Q", answer: "A" }], { params: { id: "abc" } }),
    );
    expect(res).toMatchObject({ status: 400 });
  });

  it("rejects when the application is not found / not owned", async () => {
    mockAppFindFirst.mockResolvedValueOnce(undefined);
    const res = await actions.createQuestions!(createEvent([{ question: "Q", answer: "A" }]));
    expect(res).toMatchObject({ status: 404 });
  });

  it("rejects a non-JSON payload", async () => {
    const res = await actions.createQuestions!(createEvent(null, { rawQuestions: "{not json" }));
    expect(res).toMatchObject({ status: 400 });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects a payload that is not an array", async () => {
    const res = await actions.createQuestions!(createEvent({ question: "Q" } as any));
    expect(res).toMatchObject({ status: 400 });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects an empty batch (all rows blank)", async () => {
    const res = await actions.createQuestions!(
      createEvent([{ question: "  ", answer: "  " }, { question: "", answer: "" }]),
    );
    expect(res).toMatchObject({ status: 400 });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects the whole batch when any row has an answer but no question", async () => {
    // The NOT NULL guard: never silently drop the user's answer text.
    const res = await actions.createQuestions!(
      createEvent([
        { question: "Real question", answer: "" },
        { question: "", answer: "an orphaned answer" },
      ]),
    );
    expect(res).toMatchObject({ status: 400 });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("inserts valid rows, continuing the sort sequence and nulling empty answers", async () => {
    const res = await actions.createQuestions!(
      createEvent([
        { question: "Q1", answer: "A1" },
        { question: "Q2 (no answer yet)", answer: "   " },
      ]),
    );
    expect(res).toMatchObject({ success: true, added: 2 });

    const inserted = mockValues.mock.calls[0][0];
    expect(inserted).toHaveLength(2);
    // Last existing sort was 5 → new rows continue at 6, 7.
    expect(inserted[0]).toMatchObject({ question: "Q1", answer: "A1", sort: 6 });
    expect(inserted[1]).toMatchObject({ question: "Q2 (no answer yet)", answer: null, sort: 7 });
    expect(inserted[0].application_id).toBe(1);
  });

  it("trims whitespace on questions and answers", async () => {
    await actions.createQuestions!(createEvent([{ question: "  Trimmed?  ", answer: "  yes  " }]));
    const inserted = mockValues.mock.calls[0][0];
    expect(inserted[0].question).toBe("Trimmed?");
    expect(inserted[0].answer).toBe("yes");
  });

  it("starts sort at 1 when the application has no questions yet", async () => {
    mockQFindFirst.mockResolvedValueOnce(undefined);
    await actions.createQuestions!(createEvent([{ question: "First", answer: "" }]));
    const inserted = mockValues.mock.calls[0][0];
    expect(inserted[0].sort).toBe(1);
  });
});
