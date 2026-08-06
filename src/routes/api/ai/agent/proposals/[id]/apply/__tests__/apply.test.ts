/**
 * Tests for the proposal-apply endpoint.
 *
 * What this route owns is the *proposal*: finding it, proving it belongs to the
 * caller, refusing a second application of the same one, and stamping it applied
 * exactly once and only after the write succeeded. Keyed on the proposal rather
 * than the turn, because one turn can carry several — accepting the salary fix
 * must leave the description rewrite pending.
 *
 * The write itself is `executeCapability`, and the guarantees that used to be
 * asserted here — re-authorizing at apply time, re-reading current values,
 * re-validating, dropping fields outside the capability — are tested against it
 * directly in ai-chat/__tests__/capabilities.test.ts. They moved because they
 * are not this route's promises to keep: a caller that reaches a capability
 * without a proposal row gets them too.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let storedRow: Record<string, unknown> | undefined;
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });

vi.mock("$lib/server/db", () => {
  const selectChain = {
    from: () => selectChain,
    innerJoin: () => selectChain,
    where: () => selectChain,
    limit: () => Promise.resolve(storedRow ? [storedRow] : []),
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
  },
  agent_message_proposals: {
    id: "amp.id",
    message_id: "amp.message_id",
    capability: "amp.capability",
    fields: "amp.fields",
    target: "amp.target",
    applied_at: "amp.applied_at",
  },
}));

const mockExecute = vi.fn();

vi.mock("$lib/server/ai-chat/capabilities", () => ({
  // Only what the route itself touches: the registry, to reject a stored
  // capability name that no longer exists, and the write path.
  CAPABILITIES: { edit_job_details: { title: "Edit the job's details" } },
  executeCapability: (...a: unknown[]) => mockExecute(...a),
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

/** A row of agent_message_proposals, joined out to its message's profile. */
function proposalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 77,
    profile_id: 12,
    applied_at: null,
    capability: "edit_job_details",
    rationale: "The posting says remote.",
    fields: { salary_min: 120000 },
    target: { id: 900, label: "Senior Backend Engineer at Acme" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "user-1" };
  storedRow = proposalRow();
  mockExecute.mockResolvedValue({ ok: true, previous: { salary_min: 55000 } });
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
});

describe("POST /api/ai/agent/proposals/:id/apply", () => {
  it("rejects a non-numeric id", async () => {
    const res = await POST(event("nope"));
    expect(res.status).toBe(400);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("404s a proposal that belongs to another user", async () => {
    // The query joins out through agent_messages to agent_conversations on
    // user_id, so someone else's proposal id simply returns no row —
    // indistinguishable from a missing one, which is the point.
    storedRow = undefined;
    const res = await POST(event());
    expect(res.status).toBe(404);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("refuses to apply the same proposal twice", async () => {
    storedRow = proposalRow({ applied_at: new Date() });
    const res = await POST(event());
    expect(res.status).toBe(409);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("rejects an unknown capability", async () => {
    storedRow = proposalRow({ capability: "delete_everything" });
    const res = await POST(event());
    expect(res.status).toBe(400);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("hands over the target and actor from the database, not the client", async () => {
    // The stored payload goes through as-is: filtering and coercing it is
    // executeCapability's job, and it does that to every caller rather than
    // trusting one to have done it first.
    await POST(event());
    expect(mockExecute).toHaveBeenCalledWith(
      "edit_job_details",
      { id: 900, label: "Senior Backend Engineer at Acme" },
      { profileId: 12, isStaff: false },
      { salary_min: 120000 },
    );
  });

  it.each([
    ["unauthorized", 403],
    ["invalid", 400],
    ["empty", 400],
  ])("maps a %s refusal to %i, and stamps nothing", async (reason, status) => {
    mockExecute.mockResolvedValue({ ok: false, reason, error: "Nope." });
    const res = await POST(event());
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ message: "Nope." });
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("applies and stamps that proposal as applied", async () => {
    const res = await POST(event());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ applied_at: expect.any(Date) }),
    );
  });

  it("stamps the proposal, not the turn that carried it", async () => {
    // The whole reason proposals are their own rows: a turn can carry two, and
    // accepting one must leave the other pending. Stamping by message id would
    // mark both. `eq` is mocked to return its value, so this is the id the
    // update was scoped to.
    await POST(event("77"));
    expect(mockUpdateWhere).toHaveBeenCalledWith(77);
  });

  it("stamps only after the write succeeded", async () => {
    // Stamping first would leave a failed edit looking applied, with no way to
    // retry it from the card.
    mockExecute.mockRejectedValue(new Error("db down"));
    await expect(POST(event())).rejects.toThrow("db down");
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });
});

describe("the before-image", () => {
  it("records what the write actually replaced, not what was proposed", async () => {
    // `previous` is captured again here rather than left as stored. It was
    // written when the assistant answered; the write happens later — up to
    // twelve hours later in a resumable thread — so the proposal-time values
    // would record an undo reverting to a state that never immediately
    // preceded this edit.
    await POST(event());
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        applied_at: expect.any(Date),
        previous: { salary_min: 55000 },
      }),
    );
  });
});
