/**
 * The conversation reaches the model as real turns.
 *
 * Covers the wiring the per-entity followup suites don't: that each surface
 * loads its version trail and hands it to createFollowupAiChat as messages —
 * on the REVIEW path as well as the revision path. Reviews used to see nothing
 * of the conversation on three of the four surfaces, so "AI review" would
 * re-suggest things the applicant had already decided against.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHistoryRows = vi.fn().mockResolvedValue([]);
const mockUpdateWhere = vi.fn().mockResolvedValue({});
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });

vi.mock("$lib/server/db", () => ({
  db: {
    query: {
      application_letters: { findFirst: vi.fn() },
      letter_versions: { findFirst: vi.fn() },
      application_questions: { findFirst: vi.fn() },
      question_versions: { findFirst: vi.fn() },
      project_stories: { findFirst: vi.fn() },
      cheat_sheets: { findFirst: vi.fn() },
    },
    update: () => ({ set: mockUpdateSet }),
  },
  // The conversation replay reads the version trail through dbDirect.
  dbDirect: {
    select: () => ({
      from: () => ({ where: () => ({ orderBy: mockHistoryRows }) }),
    }),
  },
}));

vi.mock("$lib/server/ai-chat/create-followup", () => ({
  createFollowupAiChat: vi.fn(),
}));

vi.mock("$lib/server/ai-chat/entity-versions", () => ({
  LETTER_VERSIONS: { fkName: "letter", table: {}, fk: {}, id: {} },
  QUESTION_VERSIONS: { fkName: "question", table: {}, fk: {}, id: {} },
  STORY_VERSIONS: { fkName: "story", table: {}, fk: {}, id: {} },
  CHEATSHEET_VERSIONS: { fkName: "cheat_sheet", table: {}, fk: {}, id: {} },
  recordVersion: vi.fn().mockResolvedValue(undefined),
  ensureBaselineVersion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("$lib/server/ai-chat/application-records", () => ({
  interviewRecordsText: vi.fn().mockResolvedValue(""),
}));
vi.mock("$lib/server/ai-chat/application-documents", () => ({
  applicationDocumentsText: vi.fn().mockResolvedValue(""),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c: any, v: any) => v),
  and: vi.fn((...a: any[]) => a),
  asc: vi.fn(),
  desc: vi.fn(),
  isNotNull: vi.fn(),
}));

vi.mock("$lib/server/db/schema", () => ({
  application_letters: {},
  letter_versions: {},
  application_questions: {},
  question_versions: {},
  project_stories: {},
  story_versions: {},
  cheat_sheets: {},
  cheat_sheet_versions: {},
}));

import { db } from "$lib/server/db";
import { createFollowupAiChat } from "$lib/server/ai-chat/create-followup";
import { createApplicationLetterFollowup } from "../ai-chat/application-letter-followup";
import { createApplicationQuestionFollowup } from "../ai-chat/application-question-followup";
import { createProfileStoryFollowup } from "../ai-chat/profile-story-followup";
import { createProfileCheatSheetFollowup } from "../ai-chat/profile-cheatsheet-followup";

/** A thread where advice was given and agreed, but never applied to a draft. */
const TRAIL = [
  {
    user_request: null,
    ai_feedback: "First pass.",
    content: "Draft one.",
    source: "ai_generation",
  },
  {
    user_request: "Lead with the intro.",
    ai_feedback: "Good idea — the intro seeds the follow-ups.",
    content: null,
    source: "ai_advice",
  },
];

/** Options handed to createFollowupAiChat by the most recent call. */
function lastOptions() {
  const calls = (createFollowupAiChat as any).mock.calls;
  return calls[calls.length - 1][2];
}

describe("followup conversation replay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHistoryRows.mockResolvedValue(TRAIL);
    (createFollowupAiChat as any).mockResolvedValue({
      success: true,
      message: "ok",
      aiChat: { id: 2, response: '{"feedback":"done","text":null}' },
    });
    (db.query.application_letters.findFirst as any).mockResolvedValue({
      id: 1,
      ai_chat_id: 1,
      letter_type: "cover_letter",
      content: "Draft one.",
      application: { id: 7, job: { title: "Engineer" } },
    });
    (db.query.letter_versions.findFirst as any).mockResolvedValue({
      content: "Draft one.",
    });
    (db.query.application_questions.findFirst as any).mockResolvedValue({
      id: 1,
      ai_chat_id: 1,
      question: "Why us?",
      answer: "Draft one.",
      application: { id: 7, job: { title: "Engineer" } },
    });
    (db.query.question_versions.findFirst as any).mockResolvedValue({
      content: "Draft one.",
    });
    (db.query.project_stories.findFirst as any).mockResolvedValue({
      id: 1,
      ai_chat_id: 1,
      title: "A migration",
      category: "technical",
      situation: "S",
      task: "T",
      action: "A",
      result: "R",
      reflection: null,
    });
    (db.query.cheat_sheets.findFirst as any).mockResolvedValue({
      id: 1,
      ai_chat_id: 1,
      title: "System design",
      content: "Draft one.",
    });
  });

  const surfaces = [
    { name: "letter", run: createApplicationLetterFollowup },
    { name: "question answer", run: createApplicationQuestionFollowup },
    { name: "STAR story", run: createProfileStoryFollowup },
    { name: "prep sheet", run: createProfileCheatSheetFollowup },
  ] as const;

  for (const { name, run } of surfaces) {
    it(`replays the thread when revising a ${name}`, async () => {
      await run(1, "Now write it", true, true);

      const { historyMessages, customVariables } = lastOptions();
      expect(historyMessages.map((m: any) => m.role)).toEqual([
        "user",
        "assistant",
        "user",
        "assistant",
      ]);
      expect(historyMessages[2].content).toBe("Lead with the intro.");
      // The signal the model was missing: advice that never reached a draft.
      expect(historyMessages[3].content).toContain("Advice only");
      // No longer smuggled into the prompt as recapped prose.
      expect(customVariables?.conversationHistory).toBeUndefined();
    });

    it(`replays the thread when reviewing a ${name}`, async () => {
      await run(1, "Please review", true, false, "review");

      const { historyMessages, customVariables } = lastOptions();
      expect(historyMessages.length).toBeGreaterThan(0);
      expect(historyMessages[2].content).toBe("Lead with the intro.");
      // Letters used to carry the history in the free-text brief slot; that
      // slot belongs to the applicant's own instructions again.
      expect(customVariables?.additionalContext).toBeUndefined();
    });
  }

  it("sends no history for a thread with no versions yet", async () => {
    mockHistoryRows.mockResolvedValue([]);

    await createApplicationLetterFollowup(1, "Write it", true, true);

    expect(lastOptions().historyMessages).toEqual([]);
  });
});
