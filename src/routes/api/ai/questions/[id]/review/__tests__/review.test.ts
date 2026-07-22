/**
 * Tests for POST /api/ai/questions/[id]/review
 *
 * The LLM call is mocked (createAndGenerateAiChat). These cover the endpoint's
 * own branches: auth, ownership, the "no answer to review" guard, response
 * parsing/validation, and that the review is non-destructive (no DB write).
 * Real model behaviour is covered by llm:smoke.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQFindFirst = vi.fn();
const mockCreateAndGenerate = vi.fn();

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    query: {
      application_questions: { findFirst: (...a: any[]) => mockQFindFirst(...a) },
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c: any, v: any) => v),
}));

vi.mock("$lib/server/db/schema", () => ({
  application_questions: { id: "aq.id" },
}));

vi.mock("$lib/server/ai-chat/utils", () => ({
  createAndGenerateAiChat: (...a: any[]) => mockCreateAndGenerate(...a),
}));

vi.mock("$lib/server/ai-chat/application-question", () => ({
  QUESTION_PROFILE_FIELDS: [],
}));

vi.mock("$lib/server/billing/require-credits", () => ({
  requireCredits: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "../+server";

function ownedQuestion(overrides: Record<string, unknown> = {}) {
  return {
    question: "Why do you want this job?",
    answer: "Because it fits my experience.",
    application: {
      profile_id: 12,
      profile: { user_id: "user-1" },
      job: { job_description: "A backend role." },
    },
    ...overrides,
  };
}

function createEvent(opts: { user?: any; id?: string; body?: unknown } = {}) {
  return {
    params: { id: opts.id ?? "1" },
    locals: { user: opts.user === undefined ? { id: "user-1" } : opts.user },
    request: opts.body !== undefined ? { json: async () => opts.body } : undefined,
  } as any;
}

function reviewResponse(feedback: string, revisedText: string | null) {
  return { success: true, aiChat: { response: JSON.stringify({ feedback, revisedText }) } };
}

describe("POST /api/ai/questions/[id]/review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated", async () => {
    await expect(POST(createEvent({ user: null }))).rejects.toMatchObject({ status: 401 });
  });

  it("rejects an invalid question id", async () => {
    await expect(POST(createEvent({ id: "abc" }))).rejects.toMatchObject({ status: 400 });
  });

  it("returns 404 when the question is not found", async () => {
    mockQFindFirst.mockResolvedValueOnce(undefined);
    const res = await POST(createEvent());
    expect(res.status).toBe(404);
  });

  it("returns 404 when the question is owned by another user", async () => {
    mockQFindFirst.mockResolvedValueOnce(
      ownedQuestion({ application: { profile_id: 12, profile: { user_id: "someone-else" }, job: null } }),
    );
    const res = await POST(createEvent());
    expect(res.status).toBe(404);
  });

  it("returns 400 when there is no answer to review", async () => {
    mockQFindFirst.mockResolvedValueOnce(ownedQuestion({ answer: "   " }));
    const res = await POST(createEvent());
    expect(res.status).toBe(400);
    expect(mockCreateAndGenerate).not.toHaveBeenCalled();
  });

  it("returns 422 when generation fails", async () => {
    mockQFindFirst.mockResolvedValueOnce(ownedQuestion());
    mockCreateAndGenerate.mockResolvedValueOnce({ success: false, message: "boom" });
    const res = await POST(createEvent());
    expect(res.status).toBe(422);
  });

  it("returns 502 when the AI response is not JSON", async () => {
    mockQFindFirst.mockResolvedValueOnce(ownedQuestion());
    mockCreateAndGenerate.mockResolvedValueOnce({ success: true, aiChat: { response: "nope" } });
    const res = await POST(createEvent());
    expect(res.status).toBe(502);
  });

  it("returns 502 when the AI response fails validation", async () => {
    mockQFindFirst.mockResolvedValueOnce(ownedQuestion());
    mockCreateAndGenerate.mockResolvedValueOnce({
      success: true,
      aiChat: { response: JSON.stringify({ revisedText: "x" }) }, // missing feedback
    });
    const res = await POST(createEvent());
    expect(res.status).toBe(502);
  });

  it("returns feedback and revisedText on success without writing to the DB", async () => {
    mockQFindFirst.mockResolvedValueOnce(ownedQuestion());
    mockCreateAndGenerate.mockResolvedValueOnce(reviewResponse("Solid, tighten the intro.", "Revised answer."));
    const res = await POST(createEvent());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      success: true,
      feedback: "Solid, tighten the intro.",
      revisedText: "Revised answer.",
    });

    // Non-destructive: the review path uses the correct prompt + profile scope
    // and never persists anything (the mocked db exposes no update at all).
    const [profileId, promptKey, vars, , options] = mockCreateAndGenerate.mock.calls[0];
    expect(profileId).toBe(12);
    expect(promptKey).toBe("review_application_question");
    expect(vars).toMatchObject({
      question: "Why do you want this job?",
      answer: "Because it fits my experience.",
      jobDescription: "A backend role.",
    });
    expect(options).toMatchObject({ profileDataFields: [] });
  });

  it("allows a null revisedText (feedback-only)", async () => {
    mockQFindFirst.mockResolvedValueOnce(ownedQuestion());
    mockCreateAndGenerate.mockResolvedValueOnce(reviewResponse("Looks great as-is.", null));
    const res = await POST(createEvent());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.revisedText).toBeNull();
  });

  it("reviews a live draft from the body even when the saved answer is empty", async () => {
    // The editor sends { draft } so it can review unsaved text non-destructively.
    mockQFindFirst.mockResolvedValueOnce(ownedQuestion({ answer: "" }));
    mockCreateAndGenerate.mockResolvedValueOnce(reviewResponse("Good draft.", null));
    const res = await POST(createEvent({ body: { draft: "My live draft answer." } }));
    expect(res.status).toBe(200);
    const [, , vars] = mockCreateAndGenerate.mock.calls[0];
    expect(vars).toMatchObject({ answer: "My live draft answer." });
  });
});
