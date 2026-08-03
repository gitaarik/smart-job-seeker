/**
 * Tests for the proposal-apply endpoint.
 *
 * This is the only path from a model's suggestion to a database write, so what
 * matters is everything it refuses to take on trust: the payload came from an
 * LLM, and the message id came from the client. Rights are re-checked here
 * because a proposal can sit in a 12h-resumable thread, and current values are
 * re-read here because the row can have moved in the meantime.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let messageRow: Record<string, unknown> | undefined;
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });

vi.mock("$lib/server/db", () => {
  const selectChain = {
    from: () => selectChain,
    innerJoin: () => selectChain,
    where: () => selectChain,
    limit: () => Promise.resolve(messageRow ? [messageRow] : []),
  };
  return {
    dbDirect: {
      select: () => selectChain,
      update: () => ({ set: (...a: unknown[]) => mockUpdateSet(...a) }),
    },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c: unknown, v: unknown) => v),
  and: vi.fn((...a: unknown[]) => a),
}));

vi.mock("$lib/server/db/schema", () => ({
  agent_conversations: { id: "ac.id", user_id: "ac.user_id" },
  agent_messages: {
    id: "am.id",
    conversation_id: "am.conversation_id",
    profile_id: "am.profile_id",
    proposal: "am.proposal",
    proposal_applied_at: "am.proposal_applied_at",
  },
}));

const mockAuthorize = vi.fn();
const mockCurrent = vi.fn();
const mockValidate = vi.fn();
const mockApply = vi.fn();

vi.mock("$lib/server/ai-chat/capabilities", () => ({
  CAPABILITIES: {
    edit_job_details: {
      title: "Edit the job's details",
      authorize: (...a: unknown[]) => mockAuthorize(...a),
      current: (...a: unknown[]) => mockCurrent(...a),
      validate: (...a: unknown[]) => mockValidate(...a),
      apply: (...a: unknown[]) => mockApply(...a),
      fieldShape: { salary_min: {}, title: {} },
    },
  },
  pickCapabilityFields: (_c: string, f: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(f).filter(([k]) => k === "salary_min" || k === "title"),
    ),
}));

let currentUser: Record<string, unknown> | null = { id: "user-1" };
vi.mock("$lib/server/utils/api-helpers", () => ({
  requireAuth: () => {
    if (!currentUser) throw new Error("unauthenticated");
    return currentUser;
  },
}));

import { POST } from "../+server";

function event(id = "77") {
  return { locals: {}, params: { id } } as never;
}

function proposalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 77,
    profile_id: 12,
    applied_at: null,
    proposal: {
      capability: "edit_job_details",
      rationale: "The posting says remote.",
      fields: { salary_min: 120000 },
      target: { id: 900, label: "Senior Backend Engineer at Acme" },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "user-1" };
  messageRow = proposalRow();
  mockAuthorize.mockResolvedValue(true);
  mockCurrent.mockResolvedValue({ title: "Senior Backend Engineer" });
  mockValidate.mockReturnValue({ ok: true });
  mockApply.mockResolvedValue(undefined);
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
});

describe("POST /api/ai/agent/proposals/:id/apply", () => {
  it("rejects a non-numeric id", async () => {
    const res = await POST(event("nope"));
    expect(res.status).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("404s a proposal that belongs to another user", async () => {
    // The query joins through agent_conversations on user_id, so someone
    // else's message id simply returns no row — indistinguishable from a
    // missing one, which is the point.
    messageRow = undefined;
    const res = await POST(event());
    expect(res.status).toBe(404);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("404s a message that carries no proposal", async () => {
    messageRow = proposalRow({ proposal: null });
    const res = await POST(event());
    expect(res.status).toBe(404);
  });

  it("refuses to apply the same proposal twice", async () => {
    messageRow = proposalRow({ applied_at: new Date() });
    const res = await POST(event());
    expect(res.status).toBe(409);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("re-authorizes at apply time, not at propose time", async () => {
    // Rights can be lost between the two — a job un-imported, an application
    // reassigned — and a resumable thread is exactly that window.
    mockAuthorize.mockResolvedValue(false);
    const res = await POST(event());
    expect(res.status).toBe(403);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("re-reads current values rather than trusting the stored ones", async () => {
    // A partial edit merges over whatever is there NOW; merging over the
    // snapshot taken when it was proposed would revert anything else that
    // happened in between.
    await POST(event());
    expect(mockCurrent).toHaveBeenCalledWith({
      id: 900,
      label: "Senior Backend Engineer at Acme",
    });
    expect(mockApply).toHaveBeenCalledWith(
      { id: 900, label: "Senior Backend Engineer at Acme" },
      { salary_min: 120000 },
      { title: "Senior Backend Engineer" },
    );
  });

  it("re-validates the stored payload", async () => {
    mockValidate.mockReturnValue({ ok: false, error: "Title cannot be empty" });
    const res = await POST(event());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      message: "Title cannot be empty",
    });
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("drops stored fields outside the capability", async () => {
    // Defence in depth: the propose path filters these too, but this row has
    // been sitting in the database and nothing about it is trusted.
    messageRow = proposalRow({
      proposal: {
        ...proposalRow().proposal,
        fields: { salary_min: 120000, cv_sent_through: "LinkedIn" },
      },
    });
    await POST(event());
    expect(mockApply).toHaveBeenCalledWith(
      expect.anything(),
      { salary_min: 120000 },
      expect.anything(),
    );
  });

  it("rejects an unknown capability", async () => {
    messageRow = proposalRow({
      proposal: { ...proposalRow().proposal, capability: "delete_everything" },
    });
    const res = await POST(event());
    expect(res.status).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("applies and stamps the message as applied", async () => {
    const res = await POST(event());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    expect(mockApply).toHaveBeenCalledTimes(1);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ proposal_applied_at: expect.any(Date) }),
    );
  });

  it("stamps only after the write succeeded", async () => {
    // Stamping first would leave a failed edit looking applied, with no way to
    // retry it from the card.
    mockApply.mockRejectedValue(new Error("db down"));
    await expect(POST(event())).rejects.toThrow("db down");
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });
});
