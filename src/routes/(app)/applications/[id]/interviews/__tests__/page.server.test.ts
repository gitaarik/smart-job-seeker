/**
 * Tests for the Interviews tab form actions.
 *
 * Two things matter here and neither is visible in the UI:
 *   1. Every action must fail closed — the application id comes from the URL,
 *      so each one re-resolves it against the caller's selected profile.
 *   2. `record_type` must be one of the known types. An unknown value would
 *      render as "Other" and never match a filter, so it is rejected rather
 *      than silently stored.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAppFindFirst = vi.fn();
const mockRecordFindFirst = vi.fn();
const mockReturning = vi.fn();
const mockValues = vi.fn().mockReturnValue({
  returning: (...a: any[]) => mockReturning(...a),
});
const mockInsert = vi.fn().mockReturnValue({
  values: (...a: any[]) => mockValues(...a),
});
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockUpdateSet = vi.fn().mockReturnValue({
  where: (...a: any[]) => mockUpdateWhere(...a),
});
const mockUpdate = vi.fn().mockReturnValue({
  set: (...a: any[]) => mockUpdateSet(...a),
});
const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockReturnValue({
  where: (...a: any[]) => mockDeleteWhere(...a),
});
const mockGetSelectedProfileId = vi.fn();

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    query: {
      applications: { findFirst: (...a: any[]) => mockAppFindFirst(...a) },
      application_records: {
        findFirst: (...a: any[]) => mockRecordFindFirst(...a),
      },
    },
    insert: (...a: any[]) => mockInsert(...a),
    update: (...a: any[]) => mockUpdate(...a),
    delete: (...a: any[]) => mockDelete(...a),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c: any, v: any) => v),
  and: vi.fn((...a: any[]) => a),
}));

vi.mock("$lib/server/db/schema", () => ({
  applications: {
    id: "applications.id",
    profile_id: "applications.profile_id",
  },
  application_records: {
    id: "ar.id",
    application_id: "ar.application_id",
  },
}));

vi.mock("$lib/server/profile/selected-profile", () => ({
  getSelectedProfileId: (...a: any[]) => mockGetSelectedProfileId(...a),
}));

// $lib/application-records is deliberately NOT mocked — the point of the type
// guard is that it agrees with the real list the UI renders.
import { actions } from "../+page.server";

type Fields = Record<string, string>;

function createEvent(fields: Fields = {}, opts: {
  user?: any;
  params?: Record<string, string>;
} = {}) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return {
    params: opts.params ?? { id: "1" },
    locals: { user: opts.user === undefined ? { id: "user-1" } : opts.user },
    cookies: {} as any,
    request: { formData: async () => fd },
  } as any;
}

const validRecord: Fields = {
  record_type: "interview_recap",
  title: "Second round with the platform team",
  content: "They pushed hard on caching.",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSelectedProfileId.mockResolvedValue(12);
  mockAppFindFirst.mockResolvedValue({ id: 1, profile_id: 12 });
  mockRecordFindFirst.mockResolvedValue({ id: 7, application_id: 1 });
  mockReturning.mockResolvedValue([{ id: 7 }]);
  mockValues.mockReturnValue({
    returning: (...a: any[]) => mockReturning(...a),
  });
  mockInsert.mockReturnValue({ values: (...a: any[]) => mockValues(...a) });
  mockUpdateWhere.mockResolvedValue(undefined);
  mockUpdateSet.mockReturnValue({
    where: (...a: any[]) => mockUpdateWhere(...a),
  });
  mockUpdate.mockReturnValue({ set: (...a: any[]) => mockUpdateSet(...a) });
  mockDeleteWhere.mockResolvedValue(undefined);
  mockDelete.mockReturnValue({ where: (...a: any[]) => mockDeleteWhere(...a) });
});

/**
 * The ownership guard is shared by all three actions, so it is asserted
 * against each one rather than only where it was first written.
 */
describe.each([
  ["create", () => actions.create!, validRecord],
  ["update", () => actions.update!, { ...validRecord, id: "7" }],
  ["delete", () => actions.delete!, { id: "7" }],
])("%s action — access guards", (_name, getAction, fields) => {
  it("rejects unauthenticated callers", async () => {
    const res = await getAction()(createEvent(fields, { user: null }));
    expect(res).toMatchObject({ status: 401 });
  });

  it("rejects when no profile is selected", async () => {
    mockGetSelectedProfileId.mockResolvedValueOnce(null);
    const res = await getAction()(createEvent(fields));
    expect(res).toMatchObject({ status: 400 });
  });

  it("rejects a non-numeric application id", async () => {
    const res = await getAction()(
      createEvent(fields, { params: { id: "abc" } }),
    );
    expect(res).toMatchObject({ status: 400 });
  });

  it("rejects an application owned by another profile", async () => {
    mockAppFindFirst.mockResolvedValueOnce(undefined);
    const res = await getAction()(createEvent(fields));
    expect(res).toMatchObject({ status: 404 });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe("create action", () => {
  it("inserts a record scoped to the application", async () => {
    const res = await actions.create!(createEvent({
      ...validRecord,
      step: "Technical interview",
      event_date: "2026-07-20",
    }));

    expect(res).toMatchObject({ success: true, createdId: 7 });
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
      application_id: 1,
      record_type: "interview_recap",
      title: "Second round with the platform team",
      content: "They pushed hard on caching.",
      step: "Technical interview",
      event_date: "2026-07-20",
    }));
  });

  it("requires a title", async () => {
    const res = await actions.create!(
      createEvent({ ...validRecord, title: "   " }),
    );
    expect(res).toMatchObject({ status: 400 });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects an unknown record type", async () => {
    const res = await actions.create!(
      createEvent({ ...validRecord, record_type: "gossip" }),
    );
    expect(res).toMatchObject({ status: 400 });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects a missing record type rather than defaulting", async () => {
    const { record_type: _omitted, ...withoutType } = validRecord;
    const res = await actions.create!(createEvent(withoutType));
    expect(res).toMatchObject({ status: 400 });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("accepts every type the UI offers", async () => {
    const { recordTypes } = await import("$lib/application-records");
    for (const type of recordTypes) {
      mockValues.mockClear();
      const res = await actions.create!(
        createEvent({ ...validRecord, record_type: type.value }),
      );
      expect(res, `type ${type.value} should be accepted`).toMatchObject({
        success: true,
      });
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ record_type: type.value }),
      );
    }
  });

  it("trims the title and nulls blank optional fields", async () => {
    await actions.create!(createEvent({
      ...validRecord,
      title: "  Screening call  ",
      content: "   ",
      step: "",
      event_date: "",
    }));

    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
      title: "Screening call",
      content: null,
      step: null,
      event_date: null,
    }));
  });

  it("links to the timeline entry it was opened from", async () => {
    await actions.create!(createEvent({ ...validRecord, status_log: "42" }));
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ status_log: 42 }),
    );
  });

  it("stores no link when the timeline entry is absent or unparseable", async () => {
    await actions.create!(createEvent(validRecord));
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ status_log: null }),
    );

    mockValues.mockClear();
    await actions.create!(
      createEvent({ ...validRecord, status_log: "not-an-id" }),
    );
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ status_log: null }),
    );
  });
});

describe("update action", () => {
  const editFields: Fields = {
    id: "7",
    record_type: "feedback",
    title: "What the recruiter said",
    content: "Budget is the sticking point.",
    step: "Screening call",
    event_date: "2026-07-21",
  };

  it("updates the record and stamps date_updated", async () => {
    const res = await actions.update!(createEvent(editFields));

    expect(res).toMatchObject({ success: true });
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
      record_type: "feedback",
      title: "What the recruiter said",
      content: "Budget is the sticking point.",
      step: "Screening call",
      event_date: "2026-07-21",
      date_updated: expect.any(Date),
    }));
  });

  it("never reassigns the record to another application", async () => {
    await actions.update!(createEvent(editFields));
    const patch = mockUpdateSet.mock.calls[0][0];
    expect(patch).not.toHaveProperty("application_id");
    expect(patch).not.toHaveProperty("status_log");
  });

  it("rejects a record id belonging to a different application", async () => {
    mockRecordFindFirst.mockResolvedValueOnce(undefined);
    const res = await actions.update!(createEvent(editFields));
    expect(res).toMatchObject({ status: 404 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric record id", async () => {
    const res = await actions.update!(
      createEvent({ ...editFields, id: "abc" }),
    );
    expect(res).toMatchObject({ status: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("requires a title", async () => {
    const res = await actions.update!(
      createEvent({ ...editFields, title: "" }),
    );
    expect(res).toMatchObject({ status: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects an unknown record type", async () => {
    const res = await actions.update!(
      createEvent({ ...editFields, record_type: "gossip" }),
    );
    expect(res).toMatchObject({ status: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("delete action", () => {
  it("deletes a record on this application", async () => {
    const res = await actions.delete!(createEvent({ id: "7" }));
    expect(res).toMatchObject({ success: true });
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("rejects a record id belonging to a different application", async () => {
    mockRecordFindFirst.mockResolvedValueOnce(undefined);
    const res = await actions.delete!(createEvent({ id: "7" }));
    expect(res).toMatchObject({ status: 404 });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric record id", async () => {
    const res = await actions.delete!(createEvent({ id: "abc" }));
    expect(res).toMatchObject({ status: 400 });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
