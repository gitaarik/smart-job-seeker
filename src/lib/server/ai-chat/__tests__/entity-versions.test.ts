/**
 * Unit tests for the shared version-history engine used by application letters
 * and questions. Pure logic over a mocked db — verifies the FK-column keying,
 * the only-if-changed guard, the conversation mapping, and the trim.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });
const mockOrderBy = vi.fn().mockResolvedValue([]);
const mockSelectWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
const mockFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    insert: (...a: any[]) => mockInsert(...a),
    delete: (...a: any[]) => mockDelete(...a),
    select: (...a: any[]) => mockSelect(...a),
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...a: any[]) => ({ and: a }),
  asc: (c: any) => ({ asc: c }),
  eq: (c: any, v: any) => ({ eq: [c, v] }),
  gt: (c: any, v: any) => ({ gt: [c, v] }),
}));

vi.mock("$lib/server/db/schema", () => ({
  letter_versions: {
    letter: "lv.letter", id: "lv.id", date_created: "lv.dc",
    content: "lv.content", source: "lv.source", ai_feedback: "lv.aif", user_request: "lv.ur",
  },
  question_versions: {
    question: "qv.question", id: "qv.id", date_created: "qv.dc",
    content: "qv.content", source: "qv.source", ai_feedback: "qv.aif", user_request: "qv.ur",
  },
}));

import {
  buildConversation,
  LETTER_VERSIONS,
  QUESTION_VERSIONS,
  recordVersion,
  recordVersionIfChanged,
  trimVersionsAfter,
} from "../entity-versions";

describe("entity-versions engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderBy.mockResolvedValue([]);
  });

  it("keys the insert by the entity's FK column name", async () => {
    await recordVersion(QUESTION_VERSIONS, { entityId: 42, content: "hi", source: "manual_edit" });
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ question: 42, content: "hi", source: "manual_edit", ai_chat: null }),
    );

    await recordVersion(LETTER_VERSIONS, { entityId: 7, content: "yo", source: "ai_generation", aiChatId: 3 });
    expect(mockInsertValues).toHaveBeenLastCalledWith(
      expect.objectContaining({ letter: 7, content: "yo", source: "ai_generation", ai_chat: 3 }),
    );
  });

  it("records a version only when content changed and is non-empty", async () => {
    // unchanged -> no insert
    expect(await recordVersionIfChanged(QUESTION_VERSIONS, {
      entityId: 1, newContent: "same", previousContent: "same", source: "manual_edit",
    })).toBe(false);
    // empty new content -> no insert
    expect(await recordVersionIfChanged(QUESTION_VERSIONS, {
      entityId: 1, newContent: "", previousContent: "old", source: "manual_edit",
    })).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();

    // changed + non-empty -> inserts
    expect(await recordVersionIfChanged(QUESTION_VERSIONS, {
      entityId: 1, newContent: "new", previousContent: "old", source: "ai_revision",
    })).toBe(true);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ question: 1, content: "new", source: "ai_revision" }),
    );
  });

  it("maps version rows into ordered conversation entries", async () => {
    const d = new Date("2026-07-22T10:00:00Z");
    mockOrderBy.mockResolvedValueOnce([
      { id: 5, date_created: d, content: "c", source: "ai_review", ai_feedback: "fb", user_request: "req" },
    ]);
    const convo = await buildConversation(LETTER_VERSIONS, 9);
    expect(convo).toEqual([
      { versionId: 5, type: "ai_review", content: "c", aiFeedback: "fb", userRequest: "req", date: d },
    ]);
  });

  it("trims versions after a given id", async () => {
    await trimVersionsAfter(QUESTION_VERSIONS, 3, 10);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDeleteWhere).toHaveBeenCalled();
  });
});
