/**
 * Replay a stored `ai_chats` turn against the provider and print the RAW
 * response — finish reason, usage, tool calls, content — rather than the parsed
 * one. Diagnostic only: it writes nothing and charges no credits.
 *
 * This exists because a turn can fail in a way no stored row explains. The one
 * it was written for reported 1,812 output tokens against an 8,192 cap and no
 * usable output, which reads as a contradiction until you see `finishReason:
 * MAX_TOKENS` and work out that Gemini's thinking tokens are charged against
 * the same budget while appearing in no token count. That finish reason is now
 * in the error message, so reach for this when the message still isn't enough:
 * it is the only way to see what the model actually emitted.
 *
 *   npx dotenvx run -f .env -- sh -c 'docker compose exec -T \
 *     -e SJS_LLM_API_KEY_GEMINI="$SJS_LLM_API_KEY_GEMINI" \
 *     app npx tsx scripts/replay-agent-turn.ts <ai_chat_id> [runs]'
 *
 * The env dance is not optional: the app process gets its keys from dotenvx at
 * startup, so a bare `docker compose exec` shell has none of them.
 *
 * Repeat runs are the point — the failures worth replaying are the intermittent
 * ones, and a single green run proves nothing. THINKING_BUDGET=<n> sets a
 * thinking cap for the run, which is how the fix in `createLangChainModel` was
 * chosen.
 *
 * Two limits, both from what `ai_chats` stores. The schema a turn used is not
 * recorded, so the capability set below is the assistant's job-page one and
 * anything else needs editing in. And `full_prompt` is a rendering of the
 * message array rather than the array itself, so the split below reverses
 * `makeFullPrompt` and will need updating if that changes.
 */
import { dbDirect as db } from "../src/lib/server/db";
import { ai_chats } from "../src/lib/server/db/schema";
import { eq } from "drizzle-orm";
import { buildProposalSchema } from "../src/lib/server/ai-chat/capabilities";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { z } from "zod";
import { config } from "../src/lib/server/config";

const ID = Number(process.argv[2]);
const RUNS = Number(process.argv[3] ?? 1);
const BUDGET = process.env.THINKING_BUDGET
  ? Number(process.env.THINKING_BUDGET)
  : undefined;
const MAX_OUT = Number(process.env.MAX_OUTPUT_TOKENS ?? 8192);

const row = await db.query.ai_chats.findFirst({ where: eq(ai_chats.id, ID) });
if (!row?.full_prompt) {
  console.error(`ai_chats ${ID}: no full_prompt stored`);
  process.exit(1);
}
const fp = row.full_prompt;

const SEP = "----------------\n\n";
const sys = fp.split(`${SEP}# SYSTEM PROMPT:\n\n${SEP}`)[1]
  ?.split(`\n\n${SEP}# CONVERSATION SO FAR`)[0]
  ?.split(`\n\n${SEP}# USER PROMPT:`)[0] ?? "";
const hist = fp.split("# CONVERSATION SO FAR (sent as separate messages):")[1]
  ?.split(`${SEP}# USER PROMPT:`)[0] ?? "";
const user = fp.split(`# USER PROMPT:\n\n${SEP}`)[1] ?? "";

const turns = hist.split(/^## (USER|ASSISTANT):$/m).slice(1);
const messages: (SystemMessage | HumanMessage | AIMessage)[] = [
  new SystemMessage(sys.trim()),
];
for (let i = 0; i < turns.length; i += 2) {
  const text = (turns[i + 1] ?? "").replace(/^-+$/gm, "").trim();
  if (!text) continue;
  messages.push(
    turns[i] === "USER" ? new HumanMessage(text) : new AIMessage(text),
  );
}
messages.push(new HumanMessage(user.trim()));

console.log(
  `${row.provider}/${row.model} system=${sys.length}ch ` +
    `history=${messages.length - 2} user=${JSON.stringify(user.trim())}` +
    (BUDGET ? ` thinkingBudget=${BUDGET}` : "") + "\n",
);

const schema = buildProposalSchema([
  "edit_job_details",
  "edit_job_description",
  "edit_job_skills",
]);

for (let n = 0; n < RUNS; n++) {
  const model = new ChatGoogleGenerativeAI({
    apiKey: config.geminiApiKey,
    model: row.model ?? "gemini-2.5-pro",
    temperature: 0.7,
    maxOutputTokens: MAX_OUT,
    ...(BUDGET ? { thinkingConfig: { thinkingBudget: BUDGET } } : {}),
  });

  const structured = model.withStructuredOutput(
    z.toJSONSchema(schema) as Record<string, unknown>,
    { name: "personal_agent_chat_capable", includeRaw: true },
  );

  console.log(`--- run ${n + 1} ---`);
  try {
    const { raw, parsed } = await structured.invoke(messages) as {
      raw: AIMessage;
      parsed: { proposals?: { capability: string }[] } | null;
    };
    const usage = raw?.usage_metadata;
    // Thinking is the difference, and the reason this script prints it: it is
    // in `total_tokens` and in neither of the other two.
    const thinking = usage
      ? usage.total_tokens - usage.input_tokens - usage.output_tokens
      : 0;
    console.log("parsed:", parsed === null ? "NULL" : "ok");
    console.log(
      `usage: in=${usage?.input_tokens} out=${usage?.output_tokens} ` +
        `thinking=${thinking} total=${usage?.total_tokens}`,
    );
    console.log("finish:", raw?.response_metadata?.finishReason ?? "unknown");
    console.log("tool_calls:", raw?.tool_calls?.length ?? 0);
    const content = typeof raw?.content === "string"
      ? raw.content
      : JSON.stringify(raw?.content);
    console.log("content:", (content ?? "").slice(0, 400));
    if (parsed) {
      console.log(
        "proposals:",
        (parsed.proposals ?? []).map((p) => p.capability).join(",") || "(none)",
      );
    }
  } catch (e) {
    console.log("THREW:", (e as Error)?.message?.slice(0, 400));
  }
}
process.exit(0);
