/**
 * Replay stored writing turns against other models and print them side by side.
 *
 * The question this answers is "would a cheaper model be good enough for the
 * application texts", and the only honest way to answer it is on OUR prompts
 * with OUR data — a leaderboard score is about a different prompt. So it takes
 * real `ai_chats` rows, rebuilds the exact message array that produced the
 * stored answer, and re-runs it everywhere else.
 *
 *   IDS=152140,152144 MODELS='groq/openai/gpt-oss-120b@low,gemini/gemini-2.5-flash' \
 *     npx dotenvx run -f .env -- sh -c 'docker compose exec -T \
 *       -e SJS_LLM_API_KEY_GEMINI="$SJS_LLM_API_KEY_GEMINI" \
 *       -e SJS_LLM_API_KEY_GROQ="$SJS_LLM_API_KEY_GROQ" \
 *       -e IDS -e MODELS app npx tsx scripts/compare-writing-models.ts'
 *
 * The env dance is not optional: a bare `docker compose exec` shell sees
 * encrypted ciphertext, not keys.
 *
 * A model spec is `provider/model[@reasoningEffort]`. The effort suffix only
 * means anything on gpt-oss, where the app pins `low` — worth varying, since
 * the app's reason for pinning it was small-budget JSON calls, not prose.
 *
 * Text-output turns only. `full_prompt` does not record the schema a
 * structured turn used, so a capability turn cannot be replayed faithfully
 * here; `replay-agent-turn.ts` hardcodes one set for exactly that reason.
 */
import { dbDirect as db } from '../src/lib/server/db';
import { ai_chats } from '../src/lib/server/db/schema';
import { inArray } from 'drizzle-orm';
import { ChatGroq } from '@langchain/groq';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { config } from '../src/lib/server/config';

const IDS = (process.env.IDS ?? '')
	.split(',')
	.map((s) => Number(s.trim()))
	.filter(Boolean);
const MODELS = (process.env.MODELS ?? 'groq/openai/gpt-oss-120b@low')
	.split(',')
	.map((s) => s.trim())
	.filter(Boolean);
const MAX_OUT = Number(process.env.MAX_OUTPUT_TOKENS ?? 4096);
const TEMP = Number(process.env.TEMPERATURE ?? 0.7);

if (!IDS.length) {
	console.error('set IDS=<comma-separated ai_chats ids>');
	process.exit(1);
}

/** Reverses makeFullPrompt(); see replay-agent-turn.ts, same caveat. */
function parseFullPrompt(fp: string) {
	const SEP = '----------------\n\n';
	const sys =
		fp
			.split(`${SEP}# SYSTEM PROMPT:\n\n${SEP}`)[1]
			?.split(`\n\n${SEP}# CONVERSATION SO FAR`)[0]
			?.split(`\n\n${SEP}# USER PROMPT:`)[0] ?? '';
	const hist =
		fp
			.split('# CONVERSATION SO FAR (sent as separate messages):')[1]
			?.split(`${SEP}# USER PROMPT:`)[0] ?? '';
	const user = fp.split(`# USER PROMPT:\n\n${SEP}`)[1] ?? '';

	const messages: (SystemMessage | HumanMessage | AIMessage)[] = [new SystemMessage(sys.trim())];
	const turns = hist.split(/^## (USER|ASSISTANT):$/m).slice(1);
	for (let i = 0; i < turns.length; i += 2) {
		const text = (turns[i + 1] ?? '').replace(/^-+$/gm, '').trim();
		if (!text) continue;
		messages.push(turns[i] === 'USER' ? new HumanMessage(text) : new AIMessage(text));
	}
	messages.push(new HumanMessage(user.trim()));
	return { messages, sysLen: sys.length, history: (messages.length - 2) / 1 };
}

/**
 * The `@` suffix is user input from a MODELS string, so it arrives as `string`
 * and has to be narrowed to the union ChatGroq accepts.
 *
 * Throws on an unrecognised value rather than dropping it. A typo'd `@lo` that
 * silently ran at the default effort would still print a column and still look
 * like a result, which is the one outcome a comparison tool must not produce.
 */
const REASONING_EFFORTS = ['low', 'medium', 'high'] as const;
type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

function asEffort(v: string): ReasoningEffort {
	if ((REASONING_EFFORTS as readonly string[]).includes(v)) return v as ReasoningEffort;
	throw new Error(`unknown reasoningEffort "${v}" — one of ${REASONING_EFFORTS.join(', ')}`);
}

function build(spec: string): BaseChatModel {
	const [path, effort] = spec.split('@');
	const slash = path.indexOf('/');
	const provider = path.slice(0, slash);
	const model = path.slice(slash + 1);
	if (provider === 'groq') {
		const isReasoning = /gpt-oss|qwen3/i.test(model);
		return new ChatGroq({
			apiKey: config.groqApiKey,
			model,
			temperature: TEMP,
			maxTokens: MAX_OUT,
			...(isReasoning && effort ? { reasoningEffort: asEffort(effort) } : {})
		}) as unknown as BaseChatModel;
	}
	if (provider === 'gemini') {
		return new ChatGoogleGenerativeAI({
			apiKey: config.geminiApiKey,
			model,
			temperature: TEMP,
			maxOutputTokens: MAX_OUT
		}) as unknown as BaseChatModel;
	}
	throw new Error(`unknown provider in "${spec}"`);
}

const rows = await db.query.ai_chats.findMany({ where: inArray(ai_chats.id, IDS) });
const byId = new Map(rows.map((r) => [r.id, r]));

console.log(`# Writing-model comparison\n`);
console.log(`temperature=${TEMP} maxOutputTokens=${MAX_OUT}\n`);

for (const id of IDS) {
	const row = byId.get(id);
	if (!row?.full_prompt) {
		console.log(`\n## ai_chats ${id} — SKIPPED (no full_prompt)\n`);
		continue;
	}
	const { messages, sysLen } = parseFullPrompt(row.full_prompt);
	const task = row.system_prompt.replace(/\s+/g, ' ').slice(0, 120);

	console.log(`\n---\n\n## ai_chats ${id}`);
	console.log(`\n**task:** ${task}…`);
	console.log(`\n**system prompt:** ${sysLen} chars, ${messages.length - 2} history turns`);
	console.log(
		`\n**user prompt:** ${JSON.stringify(String(messages[messages.length - 1].content).slice(0, 300))}`
	);
	console.log(
		`\n### ${row.provider}/${row.model} (stored) — in=${row.input_tokens} out=${row.output_tokens}\n`
	);
	console.log('```\n' + (row.response ?? '(none)') + '\n```');

	for (const spec of MODELS) {
		const t0 = Date.now();
		try {
			const res = (await build(spec).invoke(messages)) as AIMessage;
			const ms = Date.now() - t0;
			const u = res.usage_metadata;
			const content = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
			console.log(
				`\n### ${spec} — in=${u?.input_tokens} out=${u?.output_tokens} ` +
					`total=${u?.total_tokens} ${ms}ms\n`
			);
			console.log('```\n' + content + '\n```');
		} catch (e) {
			console.log(`\n### ${spec} — THREW after ${Date.now() - t0}ms\n`);
			console.log('```\n' + (e as Error)?.message?.slice(0, 600) + '\n```');
		}
	}
}
process.exit(0);
