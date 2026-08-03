/**
 * Tests for the Activity tab form actions.
 *
 * Descended from the Interviews tab's tests, but the create contract inverted
 * and the assertions had to invert with it. That tab REQUIRED a title and a
 * known `record_type` and rejected anything else; the composer asks for
 * neither, because every one of those is derived and stays editable. So the
 * old "requires a title" / "rejects a missing record type" cases are gone on
 * purpose — keeping them would have pinned the behaviour this feature exists
 * to remove.
 *
 * What still matters, and none of it is visible in the UI:
 *   1. Every action must fail closed — the application id comes from the URL,
 *      so each one re-resolves it against the caller's selected profile.
 *   2. Derivation must fill title, type, stage and date without being asked.
 *   3. `update` must treat an absent field as "leave alone", not "clear".
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
const mockUploadFile = vi.fn();
const mockDeleteFile = vi.fn();
const mockExtract = vi.fn();
const mockDerive = vi.fn();

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

vi.mock("$lib/server/files", () => ({
  uploadFile: (...a: any[]) => mockUploadFile(...a),
  deleteFile: (...a: any[]) => mockDeleteFile(...a),
}));

vi.mock("$lib/server/ai-chat/application-activity", () => ({
  extractRecordFile: (...a: any[]) => mockExtract(...a),
}));

// Mocked explicitly rather than left to fall into its own catch: derivation is
// best-effort by design, so an unmocked one would "pass" while doing nothing
// and the wiring assertions below would prove nothing.
vi.mock("$lib/server/ai-chat/record-derivation", () => ({
  deriveRecordMetadata: (...a: any[]) => mockDerive(...a),
}));

// $lib/application-records is deliberately NOT mocked — the point of the type
// guard, and of the title derivation, is that they agree with the real list
// and the real function the UI uses.
import { actions } from "../+page.server";

type Fields = Record<string, string>;

function createEvent(fields: Fields = {}, opts: {
  user?: any;
  params?: Record<string, string>;
  file?: File;
} = {}) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  if (opts.file) fd.set("file", opts.file);
  return {
    params: opts.params ?? { id: "1" },
    locals: { user: opts.user === undefined ? { id: "user-1" } : opts.user },
    cookies: {} as any,
    request: { formData: async () => fd },
  } as any;
}

const typed: Fields = {
  content: "Screening call went well\n\nThey pushed hard on caching.",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSelectedProfileId.mockResolvedValue(12);
  mockAppFindFirst.mockResolvedValue({
    id: 1,
    status: "interviewing",
    status_step: "Screening call",
  });
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
  mockUploadFile.mockResolvedValue({ id: "file-uuid" });
  mockDeleteFile.mockResolvedValue(undefined);
  mockExtract.mockResolvedValue("extracted text");
  mockDerive.mockResolvedValue({});
});

/**
 * The ownership guard is shared by all four actions, so it is asserted against
 * each one rather than only where it was first written.
 */
describe.each([
  ["create", () => actions.create!, typed],
  ["extract", () => actions.extract!, { id: "7" }],
  ["update", () => actions.update!, { id: "7", title: "x" }],
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
    expect(mockExtract).not.toHaveBeenCalled();
  });
});

describe("create action — derivation", () => {
  it("derives title, type, stage and date from nothing but the text", async () => {
    const res = await actions.create!(createEvent(typed));

    expect(res).toMatchObject({ success: true, createdId: 7 });
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
      application_id: 1,
      title: "Screening call went well",
      // Typed text is the applicant's own writing.
      record_type: "note",
      // The stage the application is in RIGHT NOW, not a guess.
      step: "Screening call",
      file_id: null,
      extraction_status: "none",
    }));
    const [[values]] = mockValues.mock.calls;
    expect(values.event_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("accepts an explicit type but never demands one", async () => {
    await actions.create!(createEvent({ ...typed, record_type: "offer" }));
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ record_type: "offer" }),
    );
  });

  // An unknown value would render as the fallback label and never match a
  // filter. It falls back to the derived default rather than 400-ing, because
  // the user never typed it — only a stale client could send one.
  it("ignores an unknown type rather than storing it", async () => {
    await actions.create!(createEvent({ ...typed, record_type: "gossip" }));
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ record_type: "note" }),
    );
  });

  it("rejects a submission with neither text nor a file", async () => {
    const res = await actions.create!(createEvent({ content: "   " }));
    expect(res).toMatchObject({ status: 400 });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("titles a file-only entry from its filename", async () => {
    const file = new File(["hello"], "take-home-brief.pdf");
    const res = await actions.create!(createEvent({}, { file }));

    expect(res).toMatchObject({ needsExtraction: true });
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
      title: "take-home-brief.pdf",
      // A file someone attached is far likelier received than written.
      record_type: "message",
      file_id: "file-uuid",
      extraction_status: "pending",
    }));
  });

  it("does not ask for extraction when there is no file", async () => {
    const res = await actions.create!(createEvent(typed));
    expect(res).toMatchObject({ needsExtraction: false });
  });

  it("derives metadata for a typed entry straight away", async () => {
    await actions.create!(createEvent(typed));
    expect(mockDerive).toHaveBeenCalledWith(7, 12);
  });

  // A file-backed entry has no content until extraction runs, so deriving here
  // would read an empty string and waste the call.
  it("defers derivation for an upload until there is text", async () => {
    await actions.create!(
      createEvent({}, { file: new File(["x"], "brief.pdf") }),
    );
    expect(mockDerive).not.toHaveBeenCalled();
  });
});

describe("update action", () => {
  // The composer derives `step` and `event_date`, and the edit form does not
  // carry `step`. Treating absent as "clear" would silently wipe the stage on
  // every edit — the whole reason this is asserted.
  it("leaves fields the form did not carry alone", async () => {
    await actions.update!(createEvent({ id: "7", title: "New title" }));

    const [[values]] = mockUpdateSet.mock.calls;
    expect(values.title).toBe("New title");
    expect(values.step).toBeUndefined();
    expect(values.event_date).toBeUndefined();
    expect(values.content).toBeUndefined();
  });

  it("clears a field the form carried as empty", async () => {
    await actions.update!(
      createEvent({ id: "7", title: "New title", step: "" }),
    );
    const [[values]] = mockUpdateSet.mock.calls;
    expect(values.step).toBeNull();
  });

  it("refuses a record belonging to another application", async () => {
    mockRecordFindFirst.mockResolvedValueOnce(undefined);
    const res = await actions.update!(createEvent({ id: "7", title: "x" }));
    expect(res).toMatchObject({ status: 404 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("delete action", () => {
  it("removes the attached blob along with the entry", async () => {
    mockRecordFindFirst.mockResolvedValueOnce({ id: 7, file_id: "file-uuid" });
    await actions.delete!(createEvent({ id: "7" }));

    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteFile).toHaveBeenCalledWith("file-uuid");
  });

  it("survives a blob that is already gone", async () => {
    mockRecordFindFirst.mockResolvedValueOnce({ id: 7, file_id: "file-uuid" });
    mockDeleteFile.mockRejectedValueOnce(new Error("not found"));
    const res = await actions.delete!(createEvent({ id: "7" }));
    // The entry is what mattered; a missing blob must not fail the request.
    expect(res).toMatchObject({ success: true });
  });

  it("touches storage not at all for a typed entry", async () => {
    mockRecordFindFirst.mockResolvedValueOnce({ id: 7, file_id: null });
    await actions.delete!(createEvent({ id: "7" }));
    expect(mockDeleteFile).not.toHaveBeenCalled();
  });
});

describe("extract action", () => {
  it("re-authorizes the record against the application", async () => {
    mockRecordFindFirst.mockResolvedValueOnce(undefined);
    const res = await actions.extract!(createEvent({ id: "7" }));
    expect(res).toMatchObject({ status: 404 });
    expect(mockExtract).not.toHaveBeenCalled();
  });

  // An image or a scan yields no text. That is not an error: the entry and its
  // download still stand, and extractRecordFile has marked it "skipped" so
  // nothing retries it.
  it("reports an unreadable file as success with extracted false", async () => {
    mockExtract.mockResolvedValueOnce(null);
    const res = await actions.extract!(createEvent({ id: "7" }));
    expect(res).toMatchObject({ success: true, extracted: false });
  });

  it("derives once the extracted text exists", async () => {
    await actions.extract!(createEvent({ id: "7" }));
    expect(mockDerive).toHaveBeenCalledWith(7, 12);
  });

  it("skips derivation when nothing could be read", async () => {
    mockExtract.mockResolvedValueOnce(null);
    await actions.extract!(createEvent({ id: "7" }));
    expect(mockDerive).not.toHaveBeenCalled();
  });
});
