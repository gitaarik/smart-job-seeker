/**
 * Tests for the assistant chat endpoint.
 *
 * The one that earns its keep is the placeholder-defaults case. The chat's
 * templates reference every evidence placeholder, so unfilled ones have to be
 * pre-filled with "" or they ship to the model as the literal "${jobDetails}".
 * Passing those empties as `customVariables` looks equivalent to passing them
 * as `placeholderDefaults` and is the opposite: customVariables are the
 * deliberate override, so they blanked the six sources the same call had just
 * assembled. The assistant told a user it "can't access your uploaded
 * documents" on a page whose scope had just fetched them, and nothing in the
 * type system or the test suite noticed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateAndGenerate = vi.fn();
const mockResolveChatContext = vi.fn();
const mockInsertValues = vi.fn();
const mockProposalInsert = vi.fn();
const mockRequireCredits = vi.fn().mockResolvedValue(undefined);

vi.mock("$lib/server/db", () => {
  const selectChain = {
    from: () => selectChain,
    where: () => selectChain,
    orderBy: () => selectChain,
    limit: () => Promise.resolve([]),
  };
  return {
    dbDirect: {
      select: () => selectChain,
      // Keyed on the table, because the two inserts are no longer
      // interchangeable: the message insert's second row is the assistant turn
      // the proposals hang off, and the proposal insert returns one id per
      // proposal — which is what the client posts back to apply one.
      insert: (table: { _name?: string }) => ({
        values: (rows: unknown) => {
          if (table?._name === "agent_message_proposals") {
            mockProposalInsert(rows);
            const list = Array.isArray(rows) ? rows : [rows];
            return {
              returning: () =>
                Promise.resolve(list.map((_, i) => ({ id: 900 + i }))),
            };
          }
          mockInsertValues(rows);
          return {
            returning: () => Promise.resolve([{ id: 100 }, { id: 101 }]),
          };
        },
      }),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c: unknown, v: unknown) => v),
  and: vi.fn((...a: unknown[]) => a),
  desc: vi.fn((c: unknown) => c),
}));

vi.mock("$lib/server/db/schema", () => ({
  agent_conversations: { id: "ac.id", user_id: "ac.user_id" },
  agent_messages: { id: "am.id", conversation_id: "am.conversation_id" },
  agent_message_proposals: { _name: "agent_message_proposals", id: "amp.id" },
}));

vi.mock("$lib/server/utils/api-helpers", () => ({
  requireAuth: () => ({ id: "user-1" }),
  requireProfileAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("$lib/server/validation/api-schemas", () => ({
  agentChatSchema: {},
  parseBody: (_s: unknown, body: unknown) => body,
}));

vi.mock("$lib/server/billing/require-credits", () => ({
  requireCredits: (...a: unknown[]) => mockRequireCredits(...a),
}));

vi.mock("$lib/server/ai-chat/utils", () => ({
  createAndGenerateAiChat: (...a: unknown[]) => mockCreateAndGenerate(...a),
}));

vi.mock("$lib/server/ai-chat/chat-context", () => ({
  resolveChatContext: (...a: unknown[]) => mockResolveChatContext(...a),
}));

vi.mock("$lib/server/ai-chat/capabilities", () => ({
  CAPABILITIES: {
    edit_job_details: {
      title: "Edit the job's details",
      validate: () => ({ ok: true }),
    },
  },
  buildProposalSchema: () => ({ schema: true }),
  describeProposalChanges: () => [
    { field: "salary_min", label: "Salary min", from: "5", to: "6" },
  ],
  fieldsFromChanges: (
    _c: string,
    changes: { field: string; value: unknown }[],
  ) => Object.fromEntries(changes.map((c) => [c.field, c.value])),
  renderCapabilityPrompt: () => "CAPABILITY BLOCK",
}));

import { POST } from "../+server";

/** The evidence placeholders the chat templates reference. */
const EVIDENCE_KEYS = [
  "jobDetails",
  "interviewHistory",
  "applicationDocuments",
  "relevantProjects",
  "relevantStories",
  "relevantApplicationTexts",
];

function event(message = "What does this job ask for?") {
  return {
    locals: { user: { id: "user-1" } },
    request: {
      json: async () => ({
        profile_id: 12,
        conversation_id: null,
        message,
        route: "/(app)/jobs/[id]",
        routeParams: { id: "3818" },
      }),
    },
  } as never;
}

/** What createAndGenerateAiChat was called with, by argument position. */
function callArgs() {
  const [, promptKey, customVariables, , options] =
    mockCreateAndGenerate.mock.calls[0];
  return { promptKey, customVariables, options };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireCredits.mockResolvedValue(undefined);
  mockResolveChatContext.mockResolvedValue({
    context: { sources: ["profile", "job"] },
    capabilities: [],
  });
  mockCreateAndGenerate.mockResolvedValue({
    success: true,
    aiChat: { id: 7, response: "Here's what it asks for." },
  });
});

describe("evidence placeholders", () => {
  it("passes the empty placeholders as defaults, not as overrides", async () => {
    // The regression. As customVariables these win over the assembled
    // evidence and blank it; as placeholderDefaults they sit underneath and
    // only cover what wasn't assembled.
    await POST(event());

    const { customVariables, options } = callArgs();
    for (const key of EVIDENCE_KEYS) {
      expect(
        customVariables,
        `${key} must not be sent as a customVariable — it would override the assembled source`,
      ).not.toHaveProperty(key);
      expect(options.placeholderDefaults).toHaveProperty(key, "");
    }
  });

  it("still sends the message as a real variable", async () => {
    await POST(event("Tell me about this role"));
    expect(callArgs().customVariables).toMatchObject({
      message: "Tell me about this role",
    });
  });
});

describe("capability routing", () => {
  it("uses the plain prompt and no schema when nothing is proposable", async () => {
    await POST(event());

    const { promptKey, customVariables, options } = callArgs();
    expect(promptKey).toBe("personal_agent_chat");
    expect(options.responseSchema).toBeUndefined();
    // No capability block either — a question-only page pays nothing for this.
    expect(customVariables).not.toHaveProperty("capabilities");
  });

  it("switches template and schema when something is proposable", async () => {
    mockResolveChatContext.mockResolvedValue({
      context: { sources: ["profile", "job"] },
      capabilities: [{
        capability: "edit_job_details",
        target: { id: 3818, label: "Data Engineer at Testco" },
        current: { salary_min: 5 },
      }],
    });
    mockCreateAndGenerate.mockResolvedValue({
      success: true,
      aiChat: {
        id: 7,
        response: JSON.stringify({
          reply: "I can do that.",
          proposals: [{
            capability: "edit_job_details",
            rationale: "You asked.",
            changes: [{ field: "salary_min", value: 6 }],
          }],
        }),
      },
    });

    const res = await POST(event("Set the salary to 6"));
    const body = await res.json();

    expect(callArgs().promptKey).toBe("personal_agent_chat_capable");
    expect(callArgs().options.responseSchema).toBeDefined();
    expect(callArgs().customVariables).toHaveProperty(
      "capabilities",
      "CAPABILITY BLOCK",
    );
    expect(body.reply).toBe("I can do that.");
    expect(body.proposals).toHaveLength(1);
    // The id the card posts back is the proposal row's, not the message's.
    expect(body.proposals[0]).toMatchObject({
      capability: "edit_job_details",
      id: 900,
    });
    // And it hangs off the assistant turn, which is the second inserted row.
    expect(mockProposalInsert).toHaveBeenCalledWith([
      expect.objectContaining({ message_id: 101 }),
    ]);
  });

  it("resolves capabilities against the session's staff flag", async () => {
    // Never from the request body — `route` and `routeParams` come from there,
    // and once they gate a write everything derived from them is re-derived.
    await POST(event());
    expect(mockResolveChatContext).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 12, isStaff: false }),
    );
  });
});

describe("degrading a bad structured reply", () => {
  beforeEach(() => {
    mockResolveChatContext.mockResolvedValue({
      context: { sources: ["profile", "job"] },
      capabilities: [{
        capability: "edit_job_details",
        target: { id: 3818, label: "Data Engineer at Testco" },
        current: {},
      }],
    });
  });

  it("keeps the answer when the model returns prose instead of JSON", async () => {
    mockCreateAndGenerate.mockResolvedValue({
      success: true,
      aiChat: { id: 7, response: "Sorry, plain text here." },
    });

    const body = await (await POST(event())).json();
    expect(body.reply).toBe("Sorry, plain text here.");
    expect(body.proposals).toEqual([]);
  });

  it("drops a proposal naming a capability that wasn't live", async () => {
    mockCreateAndGenerate.mockResolvedValue({
      success: true,
      aiChat: {
        id: 7,
        response: JSON.stringify({
          reply: "Done.",
          proposals: [{
            capability: "edit_application_details",
            rationale: "x",
            changes: [{ field: "cv_sent_through", value: "LinkedIn" }],
          }],
        }),
      },
    });

    const body = await (await POST(event())).json();
    expect(body.reply).toBe("Done.");
    expect(body.proposals).toEqual([]);
  });

  it("drops a proposal with no usable changes", async () => {
    mockCreateAndGenerate.mockResolvedValue({
      success: true,
      aiChat: {
        id: 7,
        response: JSON.stringify({
          reply: "Nothing to change.",
          proposals: [{
            capability: "edit_job_details",
            rationale: "x",
            changes: [],
          }],
        }),
      },
    });

    const body = await (await POST(event())).json();
    expect(body.reply).toBe("Nothing to change.");
    expect(body.proposals).toEqual([]);
  });

  it("keeps the good proposal when its partner is unusable", async () => {
    // The point of separate cards: one bad entry must not take the other down
    // with it. Under the old single-proposal shape this was not expressible.
    mockCreateAndGenerate.mockResolvedValue({
      success: true,
      aiChat: {
        id: 7,
        response: JSON.stringify({
          reply: "Did what I could.",
          proposals: [
            {
              capability: "edit_application_details",
              rationale: "not live here",
              changes: [{ field: "cv_sent_through", value: "LinkedIn" }],
            },
            {
              capability: "edit_job_details",
              rationale: "live",
              changes: [{ field: "salary_min", value: 6 }],
            },
          ],
        }),
      },
    });

    const body = await (await POST(event())).json();
    expect(body.proposals).toHaveLength(1);
    expect(body.proposals[0].capability).toBe("edit_job_details");
  });

  it("keeps one card per capability when the model repeats itself", async () => {
    // Two cards over the same row would let the user apply both, and the
    // second write would silently overwrite the first.
    mockCreateAndGenerate.mockResolvedValue({
      success: true,
      aiChat: {
        id: 7,
        response: JSON.stringify({
          reply: "Twice over.",
          proposals: [
            {
              capability: "edit_job_details",
              rationale: "first",
              changes: [{ field: "salary_min", value: 6 }],
            },
            {
              capability: "edit_job_details",
              rationale: "second",
              changes: [{ field: "salary_min", value: 9 }],
            },
          ],
        }),
      },
    });

    const body = await (await POST(event())).json();
    expect(body.proposals).toHaveLength(1);
    expect(body.proposals[0].rationale).toBe("first");
  });
});
