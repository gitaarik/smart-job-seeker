import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, desc, eq } from "drizzle-orm";
import { agent_conversations, agent_messages } from "$lib/server/db/schema";
import {
  requireAuth,
  requireProfileAccess,
} from "$lib/server/utils/api-helpers";
import { agentChatSchema, parseBody } from "$lib/server/validation/api-schemas";
import { requireCredits } from "$lib/server/billing/require-credits";
import type { ChatMessage } from "$lib/server/llm";
import { createAndGenerateAiChat } from "$lib/server/ai-chat/utils";
import { resolveChatContext } from "$lib/server/ai-chat/chat-context";

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
 * Every evidence placeholder the personal_agent_chat template references.
 *
 * The provider only returns keys for the sources a route actually requests, but
 * the template references all of them — and an un-supplied placeholder ships to
 * the model as the literal text "${jobDetails}". Pre-filling with "" makes the
 * absent ones silently absent, which is what the prompt's own wording assumes.
 */
const CHAT_CONTEXT_PLACEHOLDERS = [
  "jobDetails",
  "interviewHistory",
  "applicationDocuments",
  "relevantProjects",
  "relevantStories",
  "relevantApplicationTexts",
] as const;

const EMPTY_CONTEXT_VARIABLES: Record<string, string> = Object.fromEntries(
  CHAT_CONTEXT_PLACEHOLDERS.map((key) => [key, ""]),
);

/** First line of the opening message, trimmed to a sane title length. */
function deriveTitle(message: string): string {
  const firstLine = message.split("\n")[0].trim();
  return firstLine.length > 80 ? firstLine.slice(0, 77) + "…" : firstLine;
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

  // What the user is looking at, resolved server-side from the route and
  // authorized against this profile.
  const context = await resolveChatContext({
    routeId: route,
    params: routeParams ?? {},
    profileId: profile_id,
    message,
  });

  const result = await createAndGenerateAiChat(
    profile_id,
    "personal_agent_chat",
    { ...EMPTY_CONTEXT_VARIABLES, message },
    undefined,
    {
      profileDataFields: PROFILE_DATA_FIELDS,
      context,
      // Prior turns replayed as real messages rather than recapped as a
      // transcript inside the prompt — same as the four editors.
      historyMessages: history,
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

  const reply = result.aiChat.response;
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

  await db.insert(agent_messages).values([
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
  ]);

  return json({
    success: true,
    reply,
    conversation_id: conversation.id,
    title: conversation.title,
  });
};
