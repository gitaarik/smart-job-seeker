import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, desc, eq } from "drizzle-orm";
import {
  agent_conversations,
  agent_message_proposals,
  agent_messages,
} from "$lib/server/db/schema";
import {
  requireAuth,
  requireProfileAccess,
} from "$lib/server/utils/api-helpers";
import { agentChatSchema, parseBody } from "$lib/server/validation/api-schemas";
import { requireCredits } from "$lib/server/billing/require-credits";
import type { ChatMessage } from "$lib/server/llm";
import { createAndGenerateAiChat } from "$lib/server/ai-chat/utils";
import { resolveChatContext } from "$lib/server/ai-chat/chat-context";
import {
  buildProposalSchema,
  CAPABILITIES,
  type Capability,
  describeProposalChanges,
  fieldsFromChanges,
  type LiveCapability,
  renderCapabilityPrompt,
} from "$lib/server/ai-chat/capabilities";

// Profile fields the agent is allowed to reason over. Mirrors the cover-letter
// feature's set — enough to give grounded, personal advice without leaking
// billing/scraper internals into the prompt.
const PROFILE_DATA_FIELDS = [
  "name",
  "title",
  "headline",
  "subtitle",
  "summary",
  "location",
  "core_stack",
  "highlights",
  "work_experiences",
  "side_projects",
  "education",
  "tech_skill_categories",
  "languages",
];

// Recent turns sent to the model as context (~20 user/assistant exchanges).
// Older turns are dropped; summarization can be layered on later if needed.
const MAX_CONTEXT_MESSAGES = 40;

/**
 * Every evidence placeholder the personal_agent_chat templates reference.
 *
 * The provider only returns keys for the sources a route actually requests, but
 * the templates reference all of them — and an un-supplied placeholder ships to
 * the model as the literal text "${jobDetails}". Pre-filling with "" makes the
 * absent ones silently absent, which is what the prompt's own wording assumes.
 *
 * These go to `placeholderDefaults`, never to customVariables. As
 * customVariables they overrode the assembled evidence instead of backfilling
 * it, so every one of these sources was blanked before the model saw it —
 * the assistant reported it "can't access your uploaded documents" on a page
 * whose scope had just fetched them.
 */
const CHAT_CONTEXT_PLACEHOLDERS = [
  "jobDetails",
  "applicationActivity",
  "applicationPipeline",
  "pageScope",
  "activityManifest",
  "relevantProjects",
  "relevantStories",
  "relevantApplicationTexts",
  // Not a context source — the capability block, which the capable template
  // references and the plain one doesn't. Pre-filled for the same reason as
  // the rest: an un-supplied placeholder ships as literal "${capabilities}".
  "capabilities",
] as const;

const EMPTY_CONTEXT_VARIABLES: Record<string, string> = Object.fromEntries(
  CHAT_CONTEXT_PLACEHOLDERS.map((key) => [key, ""]),
);

/** First line of the opening message, trimmed to a sane title length. */
function deriveTitle(message: string): string {
  const firstLine = message.split("\n")[0].trim();
  return firstLine.length > 80 ? firstLine.slice(0, 77) + "…" : firstLine;
}

/** A validated proposal, ready to store against the assistant turn. */
type StoredProposal = {
  capability: string;
  rationale: string;
  fields: Record<string, unknown>;
  target: { id: number; label: string };
};

/**
 * Field-by-field diff for the card, using the values captured when the
 * proposal was made.
 */
function describeChanges(
  proposal: StoredProposal,
  live: LiveCapability[],
) {
  const match = live.find((c) => c.capability === proposal.capability);
  return describeProposalChanges(
    proposal.capability as Capability,
    proposal.fields,
    match?.current ?? {},
  );
}

/** One entry of the model's `proposals` list, before any of it is trusted. */
type ProposalCandidate = {
  capability?: unknown;
  rationale?: unknown;
  changes?: unknown;
};

/**
 * Validate one candidate against the capabilities that were live this turn.
 * Returns null for anything unusable — see readCapableReply for why that is
 * always a drop rather than an error.
 */
function readProposal(
  candidate: ProposalCandidate,
  live: LiveCapability[],
): StoredProposal | null {
  if (!candidate || typeof candidate.capability !== "string") return null;

  // Only a capability that was live for *this* turn, i.e. one already resolved
  // and authorized above. A model naming anything else is ignored outright.
  const match = live.find((c) => c.capability === candidate.capability);
  if (!match) {
    console.warn(
      `[agent] dropped a proposal for un-live capability ${candidate.capability}`,
    );
    return null;
  }

  const changes = Array.isArray(candidate.changes) ? candidate.changes : [];
  const fields = fieldsFromChanges(
    match.capability,
    changes as { field: string; value: unknown }[],
  );
  if (Object.keys(fields).length === 0) return null;

  const valid = CAPABILITIES[match.capability].validate(fields, match.current);
  if (!valid.ok) {
    console.warn(`[agent] dropped an invalid proposal: ${valid.error}`);
    return null;
  }

  return {
    capability: match.capability,
    rationale: typeof candidate.rationale === "string"
      ? candidate.rationale
      : "",
    fields,
    target: match.target,
  };
}

/**
 * Read a structured reply, keeping the message even when the proposals are
 * unusable.
 *
 * Every failure here degrades to "reply, fewer proposals" rather than failing
 * the turn. The user asked a question and the model answered it; a malformed or
 * unauthorized edit suggestion is not a reason to show them an error, and
 * silently dropping it is exactly the conservative direction — the worst case
 * is that a change they wanted isn't offered, and they ask again.
 *
 * Each entry is judged on its own: one bad proposal in a pair does not take the
 * good one down with it, which is the point of them being separate cards.
 */
function readCapableReply(
  raw: string,
  live: LiveCapability[],
): { reply: string; proposals: StoredProposal[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Structured output was requested but didn't come back as JSON. The text
    // is still the assistant's answer.
    return { reply: raw, proposals: [] };
  }

  const body = parsed as {
    reply?: unknown;
    proposals?: unknown;
  };
  const reply = typeof body.reply === "string" && body.reply.trim()
    ? body.reply
    : raw;

  const candidates = Array.isArray(body.proposals) ? body.proposals : [];
  const proposals = candidates
    .map((c) => readProposal(c as ProposalCandidate, live))
    .filter((p): p is StoredProposal => p !== null);

  // One card per capability. A model that splits the same capability across two
  // entries would otherwise render two cards over the same row, where applying
  // both means the second silently overwrites the first.
  const seen = new Set<string>();
  return {
    reply,
    proposals: proposals.filter((p) => {
      if (seen.has(p.capability)) {
        console.warn(
          `[agent] dropped a duplicate proposal for ${p.capability}`,
        );
        return false;
      }
      seen.add(p.capability);
      return true;
    }),
  };
}

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);

  const { profile_id, conversation_id, message, route, routeParams } =
    parseBody(
      agentChatSchema,
      await request.json(),
    );

  await requireProfileAccess(profile_id, user.id);
  // Same as every other generation endpoint. The chat was priced at 1 when it
  // was a profile blob and a question; it now assembles the same evidence and
  // calls the same writing model as a cover letter, so it costs the same.
  await requireCredits(user.id, 5);

  // Resolve the target conversation up front (ownership-checked). A new thread
  // is created lazily only after a successful reply, below.
  let conversation: { id: number; title: string | null } | undefined;
  if (conversation_id != null) {
    const [existing] = await db
      .select({ id: agent_conversations.id, title: agent_conversations.title })
      .from(agent_conversations)
      .where(
        and(
          eq(agent_conversations.id, conversation_id),
          eq(agent_conversations.user_id, user.id),
        ),
      )
      .limit(1);
    if (!existing) {
      return json(
        { success: false, message: "Conversation not found." },
        { status: 404 },
      );
    }
    conversation = existing;
  }

  // Prior turns (oldest → newest), capped to the recent window. The new message
  // isn't persisted yet, so it isn't included here.
  const history: ChatMessage[] = conversation
    ? (
      await db
        .select({
          role: agent_messages.role,
          content: agent_messages.content,
        })
        .from(agent_messages)
        .where(eq(agent_messages.conversation_id, conversation.id))
        .orderBy(desc(agent_messages.id))
        .limit(MAX_CONTEXT_MESSAGES)
    )
      .reverse()
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" as const : "user" as const,
        content: m.content,
      }))
    : [];

  // What the user is looking at, and what may be changed there — both resolved
  // server-side from the route and authorized against this profile. `route` is
  // client-supplied, so nothing derived from it is taken on trust.
  const isStaff = !!(user as { is_staff?: boolean }).is_staff ||
    !!(user as { is_admin?: boolean }).is_admin;
  const { context, capabilities } = await resolveChatContext({
    routeId: route,
    params: routeParams ?? {},
    profileId: profile_id,
    isStaff,
    message,
  });

  // Turns with nothing to propose keep the original plain-text path exactly:
  // same prompt, no schema, no capability block, no extra tokens. Only a page
  // where the user can actually change something pays for the structured one.
  const capable = capabilities.length > 0;
  const result = await createAndGenerateAiChat(
    profile_id,
    capable ? "personal_agent_chat_capable" : "personal_agent_chat",
    {
      message,
      ...(capable
        ? { capabilities: renderCapabilityPrompt(capabilities) }
        : {}),
    },
    undefined,
    {
      profileDataFields: PROFILE_DATA_FIELDS,
      context,
      // Fallbacks, NOT customVariables: passed as customVariables these blank
      // every source the line above just assembled, because customVariables are
      // the deliberate override. See placeholderDefaults in utils.ts.
      placeholderDefaults: EMPTY_CONTEXT_VARIABLES,
      // Prior turns replayed as real messages rather than recapped as a
      // transcript inside the prompt — same as the four editors.
      historyMessages: history,
      ...(capable
        ? {
          responseSchema: buildProposalSchema(
            capabilities.map((c) => c.capability),
          ),
        }
        : {}),
    },
  );

  if (!result.success || !result.aiChat?.response) {
    return json(
      {
        success: false,
        message: result.message || "The assistant could not respond.",
      },
      { status: 422 },
    );
  }

  const { reply, proposals } = capable
    ? readCapableReply(result.aiChat.response, capabilities)
    : { reply: result.aiChat.response, proposals: [] as StoredProposal[] };
  const now = new Date();

  // Persist only now that we have a reply: create the thread on first message,
  // otherwise just bump its activity timestamp.
  if (!conversation) {
    const [created] = await db
      .insert(agent_conversations)
      .values({
        user_id: user.id,
        profile_id,
        title: deriveTitle(message),
        date_created: now,
        last_message_at: now,
      })
      .returning({
        id: agent_conversations.id,
        title: agent_conversations.title,
      });
    conversation = created;
  } else {
    await db
      .update(agent_conversations)
      .set({ last_message_at: now })
      .where(eq(agent_conversations.id, conversation.id));
  }

  // Still one insert for the exchange itself (a half-written one is worse than
  // none), and returning, because the assistant row's id is what the proposals
  // hang off.
  const [, assistantMessage] = await db.insert(agent_messages).values([
    {
      conversation_id: conversation.id,
      role: "user",
      content: message,
      profile_id,
      date_created: now,
    },
    {
      conversation_id: conversation.id,
      role: "assistant",
      content: reply,
      profile_id,
      ai_chat_id: result.aiChat.id,
      date_created: now,
    },
  ]).returning({ id: agent_messages.id });

  // A row per proposal, and their ids are what the client posts back to apply
  // one — so they have to come out of the insert, not be derived from the
  // message. Skipped entirely when there is nothing to propose, which is the
  // overwhelmingly common turn.
  const stored = proposals.length > 0
    ? await db.insert(agent_message_proposals).values(
      proposals.map((p) => ({
        message_id: assistantMessage.id,
        capability: p.capability,
        rationale: p.rationale,
        fields: p.fields,
        target: p.target,
        date_created: now,
      })),
    ).returning({ id: agent_message_proposals.id })
    : [];

  return json({
    success: true,
    reply,
    conversation_id: conversation.id,
    title: conversation.title,
    message_id: assistantMessage.id,
    proposals: proposals.map((proposal, i) => ({
      id: stored[i].id,
      capability: proposal.capability,
      title: CAPABILITIES[proposal.capability as keyof typeof CAPABILITIES]
        .title,
      rationale: proposal.rationale,
      target: proposal.target,
      // Paired with the current value so the card renders a diff, not a
      // list of new values with no idea what they replace.
      changes: describeChanges(proposal, capabilities),
      applied_at: null,
    })),
  });
};
