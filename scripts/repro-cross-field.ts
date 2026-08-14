/**
 * Does the assistant put an edit on the wrong field, or the wrong row?
 *
 *   docker compose exec app npx dotenvx run -f /app/.env -- \
 *     npx tsx scripts/repro-cross-field.ts
 *
 * Opt-in, and it spends real tokens on the configured writing provider. It also
 * writes `ai_chats` rows and charges credits against the profile it runs as, so
 * point it at seed data.
 *
 * ## Why this exists
 *
 * The job long-text capability once wrote the company blurb into the posting
 * and then told the user it had updated the "About the company" section. The
 * fix made `company_description` reachable AND added a prose rule saying which
 * field holds what — in the same change, so the rule has never been tested
 * against a model that could go wrong.
 *
 * The generated profile capabilities re-ask that question at worse odds. Seven
 * sections carry `summary`, four carry `name`, and a work experience holds two
 * adjacent long texts that mean opposite things: `summary` is what the
 * applicant did, `description` is what the employer does. Namespacing the wire
 * names (`work_experience.summary`) removes the schema-level collision. It does
 * not tell the model which field it meant, and it says nothing at all about
 * which ROW.
 *
 * So this drives real multi-turn conversations with prior proposals in the
 * history — the condition the original leak needed — and prints what came back.
 * It asserts nothing: the point is to read the proposals.
 *
 * ## What it found, 2026-08-14, gemini-2.5-pro
 *
 * Two four-turn conversations, eight proposals, no leak in either direction:
 *
 *  - **Wrong row.** Asked to move a detail onto a different role at the SAME
 *    employer, it refused the part it could not reach and said where to go:
 *    "I can't edit that position from this page, but I can remove that point
 *    from this summary" — then proposed only the removal. This is the
 *    degradation the design predicted, and the reason the section pages went
 *    first: the row is fixed by the URL, so only the field can go wrong.
 *  - **Wrong field.** Asked to sharpen the employer blurb, it proposed
 *    `description` alone and left `summary` untouched.
 *  - **Moving between them.** Asked to move that detail from what the employer
 *    does into what the applicant did, it proposed BOTH fields in one proposal
 *    — summary gaining the detail, description rewritten to broader context.
 *    That is the exact operation the job capability originally got wrong.
 *  - **Namespacing.** Every field came back correctly prefixed, 8 for 8, first
 *    try.
 *
 * Two conversations on one provider is evidence, not proof, and the writing
 * provider falls back to the app model when no Gemini key is set — which is the
 * one in the stack with known structured-output quirks. `llm:smoke` carries the
 * shape assertions for that reason; this carries the multi-turn behaviour that
 * a single-turn case cannot reach.
 *
 * Configure with REPRO_PROFILE_ID, REPRO_ROLE_ID and REPRO_TURNS (a JSON array
 * of user messages). The defaults are the seeded test user's TechCorp role,
 * whose `summary` and `description` are both populated — an empty `description`
 * makes the wrong-field trap unfalsifiable, because there is nothing to leak
 * into.
 */

import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { work_experiences } from '$lib/server/db/schema';
import { resolveChatContext } from '$lib/server/ai-chat/chat-context';
import { buildProposalSchema, renderCapabilityPrompt } from '$lib/server/ai-chat/capabilities';
import { createAndGenerateAiChat } from '$lib/server/ai-chat/utils';
import type { ChatMessage } from '$lib/server/llm';

const PROFILE_ID = Number(process.env.REPRO_PROFILE_ID ?? 12);
const ROLE_ID = Number(process.env.REPRO_ROLE_ID ?? 35);

const TURNS: string[] = JSON.parse(
	process.env.REPRO_TURNS ??
		JSON.stringify([
			'Make this summary punchier — lead with the scale of the application.',
			'Good. Can you also add that I mentored two junior developers?',
			'The bit about them being a mid-size B2B SaaS company is too vague — say they build project management tools for engineering teams.',
			'Actually, move that detail about what they build into what I did instead.'
		])
);

function say(label: string, body: string) {
	console.log(`\n${'='.repeat(72)}\n${label}\n${'='.repeat(72)}\n${body}`);
}

async function main() {
	const rows = await db
		.select({
			id: work_experiences.id,
			position: work_experiences.position,
			name: work_experiences.name,
			summary: work_experiences.summary,
			description: work_experiences.description
		})
		.from(work_experiences)
		.where(eq(work_experiences.profile_id, PROFILE_ID));

	const target = rows.find((r) => r.id === ROLE_ID);
	if (!target) throw new Error(`role ${ROLE_ID} not on profile ${PROFILE_ID}`);

	// A second role at the same employer is what makes the wrong-row trap sharp:
	// the row label is then the only thing separating them.
	const sameEmployer = rows.filter((r) => r.name === target.name && r.id !== target.id);

	say(
		'SETUP',
		[
			`profile ${PROFILE_ID}, page = /profile/work-experience/${ROLE_ID}`,
			`target      : ${target.position} at ${target.name}`,
			`same employer, NOT the page: ${
				sameEmployer.map((r) => `${r.position} (#${r.id})`).join(', ') || '(none)'
			}`,
			``,
			`summary     : ${JSON.stringify(target.summary)}`,
			`description : ${JSON.stringify(target.description)}`
		].join('\n')
	);

	if (!target.description) {
		console.warn(
			'\n⚠  description is empty, so "fix the company blurb" has nothing to leak into.\n' +
				'   Pick a role with both long texts populated, or the wrong-field result means nothing.'
		);
	}

	const history: ChatMessage[] = [];

	for (const [i, message] of TURNS.entries()) {
		const { context, capabilities } = await resolveChatContext({
			routeId: '/(app)/profile/(data)/work-experience/[id]',
			params: { id: String(ROLE_ID) },
			profileId: PROFILE_ID,
			isStaff: false,
			message
		});

		if (capabilities.length === 0) {
			throw new Error('no capability resolved — check the route scope and the row owner');
		}

		const result = await createAndGenerateAiChat(
			PROFILE_ID,
			'personal_agent_chat_capable',
			{ message, capabilities: renderCapabilityPrompt(capabilities) },
			undefined,
			{
				context,
				historyMessages: history,
				responseSchema: buildProposalSchema(capabilities.map((c) => c.capability))
			}
		);

		const raw = result.aiChat?.response ?? '';
		let parsed: { reply?: string; proposals?: unknown[] };
		try {
			parsed = JSON.parse(raw);
		} catch {
			// Structured output was asked for and did not come back as JSON, which
			// is itself a result worth seeing rather than a reason to stop.
			say(`TURN ${i + 1} — UNPARSEABLE`, raw.slice(0, 1500));
			continue;
		}

		const proposals = Array.isArray(parsed.proposals) ? parsed.proposals : [];
		const rendered = proposals.map((p) => {
			const proposal = p as {
				capability?: string;
				rationale?: string;
				changes?: { field?: string; value?: unknown }[];
			};
			const changes = (proposal.changes ?? [])
				.map((c) => `      ${c.field} = ${JSON.stringify(c.value)}`)
				.join('\n');
			return `   capability: ${proposal.capability}\n   rationale: ${proposal.rationale}\n   changes:\n${changes}`;
		});

		say(
			`TURN ${i + 1}  «${message}»`,
			[
				`REPLY:\n${parsed.reply ?? '(none)'}`,
				``,
				`PROPOSALS (${proposals.length}):`,
				rendered.join('\n\n') || '   (none)'
			].join('\n')
		);

		// Replayed as real turns, not recapped — the same shape the endpoint uses,
		// and the condition the original leak needed to appear at all.
		history.push({ role: 'user', content: message });
		history.push({ role: 'assistant', content: parsed.reply ?? '' });
	}

	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
