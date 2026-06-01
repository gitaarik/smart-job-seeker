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
import { createAndGenerateAiChat } from "$lib/server/ai-chat/utils";

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

const MAX_PAGE_CONTEXT_CHARS = 6000;

// Recent turns sent to the model as context (~20 user/assistant exchanges).
// Older turns are dropped; summarization can be layered on later if needed.
const MAX_CONTEXT_MESSAGES = 40;

/** Render the page snapshot into a compact, LLM-friendly block. */
function formatPageContext(
  pageContext: { label?: string; data?: unknown } | null | undefined,
): string {
  if (!pageContext || (!pageContext.label && pageContext.data === undefined)) {
    return "The user is on a general dashboard page; nothing specific is open.";
  }

  const parts: string[] = [];
  if (pageContext.label) parts.push(pageContext.label);
  if (pageContext.data !== undefined) {
    let serialized = JSON.stringify(pageContext.data, null, 2);
    if (serialized.length > MAX_PAGE_CONTEXT_CHARS) {
      serialized = serialized.slice(0, MAX_PAGE_CONTEXT_CHARS) +
        "\n… (truncated)";
    }
    parts.push("```json\n" + serialized + "\n```");
  }
  return parts.join("\n\n");
}

/** Turn prior turns into a readable transcript for the prompt. */
function formatConversation(
  messages: { role: string; content: string }[],
): string {
  if (messages.length === 0) return "(this is the first message)";
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
}

/** First line of the opening message, trimmed to a sane title length. */
function deriveTitle(message: string): string {
  const firstLine = message.split("\n")[0].trim();
  return firstLine.length > 80 ? firstLine.slice(0, 77) + "…" : firstLine;
}

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);

  const { profile_id, conversation_id, message, pageContext } = parseBody(
    agentChatSchema,
    await request.json(),
  );

  await requireProfileAccess(profile_id, user.id);
  await requireCredits(user.id, 1);

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
  const history = conversation
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
    ).reverse()
    : [];

  const result = await createAndGenerateAiChat(
    profile_id,
    "personal_agent_chat",
    {
      conversation: formatConversation(history),
      message,
      pageContext: formatPageContext(pageContext),
    },
    undefined,
    { profileDataFields: PROFILE_DATA_FIELDS },
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
