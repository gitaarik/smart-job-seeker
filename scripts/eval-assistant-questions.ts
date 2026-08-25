/**
 * Ask the shipped assistant a set of questions and print what it actually says.
 *
 * An eval harness, not a demo: it exists to find out what the assistant cannot
 * answer today, so it must not help it — one cold question per turn, no
 * history, no hints, at the page scope a user would ask it from.
 *
 * ## The questions come from stdin, deliberately
 *
 * A question set names real applications, real companies and real people, which
 * is exactly what this repository must not carry. So the harness is generic and
 * public; the questions live wherever their subject does (for the knowledge
 * graph work: `planning/evidence/*.json` in the private sjs-ops repo) and
 * arrive on stdin. `docker compose exec -T` forwards stdin, which is what makes
 * this work without mounting anything new.
 *
 *   cat ../../planning/evidence/graph-questions.json | \
 *     npx dotenvx run -f .env -- sh -c 'docker compose exec -T \
 *       -e SJS_LLM_API_KEY_GEMINI="$SJS_LLM_API_KEY_GEMINI" \
 *       -e SJS_LLM_API_KEY_GROQ="$SJS_LLM_API_KEY_GROQ" \
 *       app npx tsx scripts/eval-assistant-questions.ts <profile_id> [only]'
 *
 * The env dance is not optional — a bare `docker compose exec` shell sees
 * encrypted ciphertext, not keys.
 *
 * Input is a JSON array of:
 *   { q: string, route: string, probe?: string, why?: string }
 * `route` is a SvelteKit route id, e.g. "/(app)/applications". `probe` and
 * `why` are free-text notes echoed with the answer, so a later reader can tell
 * a fair miss from a rigged one.
 *
 * `only` runs a single question by number, for iterating on one case.
 *
 * ## Caveat: this MIRRORS the route, it does not call it
 *
 * `/api/ai/agent` needs a session and charges credits, so this reproduces its
 * generation path instead — same two calls, same prompt keys, same
 * PROFILE_DATA_FIELDS, same placeholderDefaults — and skips auth, credits and
 * thread persistence. If that route changes, this drifts silently. Same
 * limitation `replay-agent-turn.ts` carries about itself.
 */
import { readFileSync } from 'node:fs';
import { resolveChatContext } from '../src/lib/server/ai-chat/chat-context';
import { createAndGenerateAiChat } from '../src/lib/server/ai-chat/utils';
import {
	buildProposalSchema,
	renderCapabilityPrompt
} from '../src/lib/server/ai-chat/capabilities';

interface EvalQuestion {
	q: string;
	route: string;
	probe?: string;
	why?: string;
}

const PROFILE_ID = Number(process.argv[2] ?? 1);
const ONLY = process.argv[3] ? Number(process.argv[3]) : null;

/** Mirrors PROFILE_DATA_FIELDS in src/routes/api/ai/agent/+server.ts. */
const PROFILE_DATA_FIELDS = [
	'name',
	'title',
	'headline',
	'subtitle',
	'summary',
	'location',
	'core_stack',
	'highlights',
	'work_experiences',
	'side_projects',
	'education',
	'tech_skill_categories',
	'languages'
];

function readQuestions(): EvalQuestion[] {
	if (process.stdin.isTTY) {
		console.error('No questions on stdin. Pipe a JSON array in — see the header.');
		process.exit(1);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(0, 'utf-8'));
	} catch (err) {
		console.error(`stdin is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
		process.exit(1);
	}
	if (!Array.isArray(parsed) || parsed.length === 0) {
		console.error('Expected a non-empty JSON array of { q, route, probe?, why? }.');
		process.exit(1);
	}
	for (const [i, item] of parsed.entries()) {
		const bad =
			!item ||
			typeof item !== 'object' ||
			typeof item.q !== 'string' ||
			typeof item.route !== 'string';
		if (bad) {
			console.error(`Question ${i + 1} needs a string \`q\` and a string \`route\`.`);
			process.exit(1);
		}
	}
	return parsed as EvalQuestion[];
}

async function ask(item: EvalQuestion, n: number) {
	const { context, capabilities } = await resolveChatContext({
		routeId: item.route,
		params: {},
		profileId: PROFILE_ID,
		isStaff: false,
		message: item.q,
		history: []
	});

	const capable = capabilities.length > 0;
	const result = await createAndGenerateAiChat(
		PROFILE_ID,
		capable ? 'personal_agent_chat_capable' : 'personal_agent_chat',
		{
			message: item.q,
			...(capable ? { capabilities: renderCapabilityPrompt(capabilities) } : {})
		},
		undefined,
		{
			profileDataFields: PROFILE_DATA_FIELDS,
			context,
			historyMessages: [],
			...(capable
				? { responseSchema: buildProposalSchema(capabilities.map((c) => c.capability)) }
				: {})
		}
	);

	console.log(`\n${'='.repeat(78)}`);
	console.log(`Q${n}. ${item.q}`);
	if (item.probe) console.log(`     probe: ${item.probe}`);
	if (item.why) console.log(`     why:   ${item.why}`);
	console.log(`     scope: ${item.route}   capabilities: ${capabilities.length}`);
	console.log(`     prompt: ${result.aiChat?.full_prompt?.length ?? 0} chars`);
	console.log('-'.repeat(78));

	if (!result.success || !result.aiChat?.response) {
		console.log(`!! FAILED: ${result.message ?? 'no response'}`);
		return;
	}
	// Capable turns return the structured envelope; the reply is inside it.
	let reply = result.aiChat.response;
	try {
		const parsed = JSON.parse(reply);
		if (parsed && typeof parsed === 'object' && typeof parsed.reply === 'string') {
			reply = parsed.reply;
		}
	} catch {
		// Plain-text turn — the response IS the reply.
	}
	console.log(reply.trim());
}

const questions = readQuestions();
const items = ONLY ? [questions[ONLY - 1]] : questions;
let n = ONLY ?? 1;
for (const item of items) {
	if (!item) continue;
	try {
		await ask(item, n);
	} catch (err) {
		console.log(`\n${'='.repeat(78)}`);
		console.log(`Q${n}. ${item.q}`);
		console.log(`!! THREW: ${err instanceof Error ? err.message : String(err)}`);
	}
	n++;
}
process.exit(0);
