/**
 * Replays an entity's version trail as real chat turns.
 *
 * Letters, question answers, STAR stories and prep sheets all keep an
 * append-only version trail (see entity-versions.ts) that the applicant grows
 * by talking to the model. Every followup used to flatten that trail into one
 * markdown blob under a "## Previous Feedback" heading inside the system
 * prompt, and send it as a single turn. Two things went wrong with that:
 *
 * 1. Recapped prose reads as background. Models weight an actual user turn far
 *    more heavily than a transcript of one, so a request the applicant made two
 *    turns ago — and the model agreed to — would quietly stop being binding.
 *    Observed on letter 61: advice about the interview intro was accepted, then
 *    dropped from the very next revision, and had to be asked for again.
 * 2. It duplicated the document. The blob carried the full draft after each
 *    recent turn AND the system prompt carried the current draft, so the same
 *    ~6 KB text could be sent three times in one request.
 *
 * So: one builder, four surfaces, emitting alternating user/assistant messages
 * that go to the provider as a genuine conversation. Advice-only turns are
 * marked as such — that is the specific signal that was missing — and any draft
 * the system prompt already carries in full is replaced by a pointer to it.
 */
import { dbDirect as db } from "$lib/server/db";
import { asc, eq } from "drizzle-orm";
import {
  AIMessage,
  type BaseMessage,
  HumanMessage,
  mergeMessageRuns,
  trimMessages,
} from "@langchain/core/messages";
import type { ChatMessage } from "$lib/server/llm";
import type { VersionBinding } from "./entity-versions";

/** One version row, as much of it as the replay needs. */
export type VersionTurn = {
  user_request: string | null;
  ai_feedback: string | null;
  content: string | null;
  source: string | null;
};

export type HistoryOptions = {
  /** Entity noun used in the narration — "letter", "answer", "story", "sheet". */
  noun: string;
  /**
   * The draft the system prompt already carries in full. Any turn whose content
   * matches is narrated as a pointer instead of repeating the whole document.
   */
  currentContent?: string | null;
  /** Token ceiling for the replayed thread. Defaults to HISTORY_TOKEN_BUDGET. */
  maxTokens?: number;
};

/**
 * How much of the thread we're willing to spend on replayed turns. The system
 * prompt (profile, job, current draft, attached documents) already runs to
 * ~20k tokens on a busy application, so this is a ceiling on the conversation
 * alone, not on the request.
 */
export const HISTORY_TOKEN_BUDGET = 12000;

/**
 * Rough token count — 4 chars/token plus a few for per-message framing. Good
 * enough to keep a thread inside its budget, and it beats the old cap, which
 * counted *versions* (DRAFT_WINDOW = 6) and so was blind to whether those
 * versions were one-line answers or 8 KB cheat sheets.
 */
function approximateTokens(messages: BaseMessage[]): number {
  return messages.reduce(
    (total, m) => total + Math.ceil(String(m.content).length / 4) + 4,
    0,
  );
}

/** Replay one version trail as LangChain messages. */
function turnsToBaseMessages(
  turns: VersionTurn[],
  opts: HistoryOptions,
): BaseMessage[] {
  const { noun, currentContent } = opts;
  const current = currentContent?.trim();

  /**
   * Quote a draft, unless it is the one the system prompt already shows in
   * full — then point at that copy instead of sending a second one.
   */
  const draft = (content: string): string =>
    current && content.trim() === current
      ? `_(This produced the current ${noun}, shown in full above.)_`
      : `_The ${noun} then read:_\n\n${content}`;

  const messages: BaseMessage[] = [];
  for (const turn of turns) {
    // A version the applicant wrote or pasted themselves. It carries no
    // exchange, so it replays as them handing over new text.
    if (turn.source === "manual_edit") {
      if (turn.content) {
        messages.push(
          new HumanMessage(
            `I wrote this version of the ${noun} myself:\n\n${
              draft(turn.content)
            }`,
          ),
        );
      }
      continue;
    }

    if (turn.user_request) messages.push(new HumanMessage(turn.user_request));

    const reply: string[] = [];
    if (turn.ai_feedback) reply.push(turn.ai_feedback);
    if (turn.content) {
      reply.push(draft(turn.content));
    } else if (turn.ai_feedback) {
      // The turn this whole module exists for. An advice turn changed nothing,
      // so whatever was agreed in it is still outstanding work — without this
      // marker it is indistinguishable from advice that was already applied,
      // and the model treats it as settled.
      reply.push(
        `_(Advice only — I did not change the ${noun} in this turn, so anything agreed here still needs to be applied.)_`,
      );
    }
    if (reply.length) messages.push(new AIMessage(reply.join("\n\n")));
  }

  // The opening turn is usually a bare "generate" click, so it has no message
  // of its own and the thread would start on an assistant turn. Providers want
  // a user turn first, and `trimMessages(startOn: "human")` would drop the
  // opening draft outright — losing the wording the applicant may later ask to
  // restore. Narrate the click instead, which is what actually happened.
  if (messages.length > 0 && messages[0].getType() === "ai") {
    messages.unshift(new HumanMessage(`Write the first draft of the ${noun}.`));
  }
  return messages;
}

/**
 * Replay a version trail as chat messages, merged and trimmed to budget.
 *
 * `mergeMessageRuns` collapses consecutive same-role turns, which happens for
 * real: "delete response, keep my message" leaves a user turn with no reply, so
 * without merging the next message would arrive as a second user turn in a row.
 * `trimMessages` then keeps the most recent turns within budget and guarantees
 * the result opens on a user turn, which is what providers expect after a
 * system message.
 */
export function turnsToMessages(
  turns: VersionTurn[],
  opts: HistoryOptions,
): Promise<ChatMessage[]> {
  const merged = mergeMessageRuns(turnsToBaseMessages(turns, opts));
  return trimMessages(merged, {
    maxTokens: opts.maxTokens ?? HISTORY_TOKEN_BUDGET,
    tokenCounter: approximateTokens,
    strategy: "last",
    startOn: "human",
    includeSystem: false,
    allowPartial: false,
  }).then((trimmed) =>
    trimmed.map((m) => ({
      role: m.getType() === "ai" ? ("assistant" as const) : ("user" as const),
      content: String(m.content),
    }))
  );
}

/** Load an entity's version trail and replay it as chat messages. */
export async function buildConversationMessages(
  vt: VersionBinding,
  entityId: number,
  opts: HistoryOptions,
): Promise<ChatMessage[]> {
  const rows = await db
    .select({
      user_request: vt.table.user_request,
      ai_feedback: vt.table.ai_feedback,
      content: vt.table.content,
      source: vt.table.source,
    })
    .from(vt.table)
    .where(eq(vt.fk, entityId))
    .orderBy(asc(vt.id));

  if (rows.length === 0) return [];
  return turnsToMessages(rows as VersionTurn[], opts);
}
