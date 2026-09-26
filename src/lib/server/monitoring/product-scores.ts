/**
 * What applicants do with what the models wrote, as Langfuse scores
 * (planning/LANGFUSE.md § Scores). Each lands on the generation that wrote the
 * answer (`ai_chats.observation_id`), so Langfuse adds them up by the prompt
 * version that generation ran:
 *
 * - `proposal_applied`: 0 when the assistant proposes a change, 1 when the
 *   applicant applies it. Averaged, the apply rate.
 * - `edit_undone`: 0 when a proposal's change is applied, 1 when it is undone.
 * - `version_used`: 0 when a model writes a version of a text, 1 when the
 *   applicant makes it the text.
 *
 * A score's id is what it is about, so the 1 replaces the 0 (Langfuse keeps the
 * last value written under an id) and a retry never doubles one. The id carries
 * the environment, because preview and production share a project and their
 * row ids overlap.
 *
 * SJS's own tables stay the record; Langfuse keeps these for analysis. Posting
 * one never throws and never makes anyone wait: it runs after the applicant's
 * action has succeeded, and the client sends its queue on its own.
 */
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { agent_message_proposals, agent_messages, ai_chats } from '$lib/server/db/schema';
import { langfuseClient } from './langfuse-client';
import { getEnvironmentName } from './sentry';
import { sendsToLangfuse } from './telemetry';

export type ProductScore = 'proposal_applied' | 'edit_undone' | 'version_used';

let client: ReturnType<typeof langfuseClient> | undefined;

/**
 * Score the generation behind an `ai_chats` row. `about` names what is scored,
 * `proposal:17`, and makes the score's id with its name and the environment.
 * Nothing happens for a row whose trace was not recorded.
 */
export function scoreGeneration(
	aiChatId: number | null | undefined,
	name: ProductScore,
	about: string,
	value: boolean
): void {
	if (!aiChatId || !sendsToLangfuse()) return;
	settle(name, about, send(aiChatId, name, about, value));
}

/** The same, for the assistant turn that made a proposal. */
export function scoreProposalTurn(
	proposalId: number,
	name: ProductScore,
	about: string,
	value: boolean
): void {
	if (!sendsToLangfuse()) return;
	settle(
		name,
		about,
		(async () => {
			const [row] = await db
				.select({ aiChatId: agent_messages.ai_chat_id })
				.from(agent_message_proposals)
				.innerJoin(agent_messages, eq(agent_message_proposals.message_id, agent_messages.id))
				.where(eq(agent_message_proposals.id, proposalId))
				.limit(1);
			if (row?.aiChatId) await send(row.aiChatId, name, about, value);
		})()
	);
}

async function send(
	aiChatId: number,
	name: ProductScore,
	about: string,
	value: boolean
): Promise<void> {
	const [row] = await db
		.select({ traceId: ai_chats.trace_id, observationId: ai_chats.observation_id })
		.from(ai_chats)
		.where(eq(ai_chats.id, aiChatId))
		.limit(1);
	if (!row?.traceId) return;
	client ??= langfuseClient();
	const environment = getEnvironmentName();
	client?.score.create({
		id: `${environment}:${name}:${about}`,
		// Filed with the traces; the client's default is Langfuse's `default`.
		environment,
		traceId: row.traceId,
		observationId: row.observationId ?? undefined,
		name,
		value: value ? 1 : 0,
		dataType: 'BOOLEAN'
	});
}

function settle(name: ProductScore, about: string, work: Promise<unknown>): void {
	work.catch((error: unknown) =>
		console.warn(
			`[product scores] ${name} ${about}: ${error instanceof Error ? error.message : String(error)}`
		)
	);
}
