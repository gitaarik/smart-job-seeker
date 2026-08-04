/**
 * Does the Groq model's tool calling still "conflict with our schemas"?
 *
 * `generateWithLangChain` routes Groq away from tool-call-based structured
 * output with exactly that comment. It predates the model swap — it reasons
 * about Llama 4 echoing schema definitions — and an agent loop cannot avoid
 * tool calls, so the fallback provider either supports them or any future agent
 * path is Gemini-only. That is worth knowing before designing around it.
 *
 * Opt-in and NOT part of any suite: it costs real API calls, and like
 * `llm:smoke` it exists because mocked tests cannot catch model behaviour. Run
 * it again after a model or provider swap.
 *
 *   docker compose exec worker sh -c \
 *     'cd /app/oss && npx tsx scripts/probe-groq-tools.ts'
 *
 * The worker container, not app — the Groq key lives there. Do NOT rm the
 * script from inside the container afterwards: /app/oss is a bind mount of the
 * source tree, so that deletes the real file.
 *
 * Four shapes, easiest to hardest:
 *   1. a trivial tool      — does tool calling work at all
 *   2. a read_entry tool   — the shape an activity read-tool would have
 *   3. the loop            — call the tool, feed the result back, get an answer
 *   4. the proposal schema — loose wire types, enums, mixed optional fields:
 *                            the thing the comment says conflicts
 *
 * Result 2026-08-04, openai/gpt-oss-120b: 4/4. See the comment in
 * `llm/langchain.ts` for what that does and does not license.
 */
import { ChatGroq } from "@langchain/groq";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";

const model = new ChatGroq({
  apiKey: process.env.SJS_LLM_API_KEY_GROQ,
  model: "openai/gpt-oss-120b",
  temperature: 0,
  maxTokens: 2000,
});

const results: string[] = [];
function report(name: string, ok: boolean, detail: string) {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(34)} ${detail}`);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}\n`);
}

/* 1 — does tool calling work at all */
const getWeather = tool(
  async ({ city }: { city: string }) => `18C and raining in ${city}`,
  {
    name: "get_weather",
    description: "Current weather for a city.",
    schema: z.object({ city: z.string().describe("City name") }),
  },
);

try {
  const res = await model.bindTools([getWeather]).invoke([
    new HumanMessage("What is the weather in Amsterdam? Use the tool."),
  ]);
  const calls = res.tool_calls ?? [];
  report(
    "1. basic tool call",
    calls.length === 1 && calls[0].name === "get_weather",
    JSON.stringify(calls),
  );
} catch (e) {
  report("1. basic tool call", false, (e as Error).message.slice(0, 200));
}

/* 2 — the shape an activity read-tool would actually have */
const readEntry = tool(
  async ({ entry_id }: { entry_id: number }) =>
    `[entry ${entry_id}] The interviewer said the runway extends to March 2028.`,
  {
    name: "read_activity_entry",
    description:
      "Read the full text of one activity entry on this application. Use when " +
      "the entry you need is shown only in part.",
    schema: z.object({
      entry_id: z.number().describe("The id from the entry manifest"),
      reason: z.string().describe("Why the full text is needed"),
    }),
  },
);

let loopOk = false;
try {
  const bound = model.bindTools([readEntry]);
  const first = await bound.invoke([
    new HumanMessage(
      "Manifest of this application's activity:\n" +
        "- id 45, transcript, 'QA follow-up call', 29163 chars (you hold 1478)\n" +
        "- id 44, note, 'Intake prep', 10547 chars (complete)\n\n" +
        "What did the interviewer say about the runway?",
    ),
  ]);
  const calls = first.tool_calls ?? [];
  report(
    "2. read-tool call + args",
    calls.length === 1 && calls[0].args?.entry_id === 45,
    JSON.stringify(calls),
  );

  /* the loop: feed the tool result back and get a final answer */
  if (calls.length === 1) {
    const second = await bound.invoke([
      new HumanMessage("What did the interviewer say about the runway?"),
      new AIMessage({ content: "", tool_calls: calls }),
      new ToolMessage({
        content: await readEntry.invoke(calls[0].args as { entry_id: number }),
        tool_call_id: calls[0].id!,
      }),
    ]);
    // Normalise first: gpt-oss emitted "March\u202F2028" with a NARROW NO-BREAK
    // SPACE, so a literal /March 2028/ scored a correct answer as a failure.
    // Anything asserting on model prose has to fold unicode spaces.
    const text = String(second.content).replace(/[\u00a0\u202f\u2009]/g, " ");
    loopOk = /March 2028/.test(text);
    report("3. tool result fed back", loopOk, text.slice(0, 160));
  }
} catch (e) {
  report("2/3. read-tool loop", false, (e as Error).message.slice(0, 200));
}

/* 4 — the loose proposal schema the comment says conflicts */
const proposeEdit = tool(
  async () => "stored",
  {
    name: "propose_edit",
    description: "Propose an edit to the job or application for the user to apply.",
    schema: z.object({
      changes: z.array(z.object({
        capability: z.enum([
          "edit_job_details",
          "edit_application_details",
          "edit_job_description",
        ]),
        // Deliberately loose, exactly like WIRE_TYPES: a bare string where an
        // array belongs, a quoted number where a number belongs.
        work_location: z.string().optional().describe('e.g. "remote"'),
        salary_min: z.string().optional().describe('e.g. "55,000"'),
        description: z.string().optional(),
        rationale: z.string(),
      })).describe("One entry per change proposed"),
    }),
  },
);

try {
  const res = await model.bindTools([proposeEdit]).invoke([
    new HumanMessage(
      "This job listing says the role is on-site but the recruiter email says " +
        "it is fully remote and pays 55,000 EUR. Propose the corrections.",
    ),
  ]);
  const calls = res.tool_calls ?? [];
  const args = calls[0]?.args as { changes?: unknown[] } | undefined;
  report(
    "4. loose proposal schema",
    calls.length === 1 && Array.isArray(args?.changes) &&
      args!.changes!.length > 0,
    JSON.stringify(calls[0]?.args).slice(0, 300),
  );
} catch (e) {
  report("4. loose proposal schema", false, (e as Error).message.slice(0, 250));
}

console.log("\n===== summary =====");
for (const r of results) console.log(r);
