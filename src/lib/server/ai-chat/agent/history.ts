/**
 * The thread as the model sees it, and the helpers the route and the agent's
 * turn share for it (planning/ASSISTANT-AGENT.md § Records and tracing).
 */
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import {
	agent_message_proposals,
	agent_messages,
	ai_chats,
	capability_edits
} from '$lib/server/db/schema';
import type { ChatMessage } from '$lib/server/llm';
import {
	type ProposalOutcome,
	renderProposalOutcomes
} from '$lib/server/ai-chat/proposal-outcomes';
import type { ReadRecord, RetrievalRecord } from '$lib/server/documents/retrieval-record';

// Recent turns sent to the model as context (~20 user/assistant exchanges).
// Older turns are dropped; summarization can be layered on later if needed.
export const MAX_CONTEXT_MESSAGES = 40;

/**
 * What each of a window's turns proposed and whether it was applied, grouped by
 * turn.
 *
 * Read straight from the proposal rows rather than through the transcript
 * endpoint's richer shape: this needs the fate of a proposal, not its diff, and
 * rebuilding the diffs would mean a `current` read per proposal per turn — the
 * expensive half of that endpoint, spent to produce something no one reads.
 */
export async function readProposalOutcomes(
	messageIds: number[]
): Promise<Map<number, ProposalOutcome[]>> {
	const rows = await db
		.select({
			message_id: agent_message_proposals.message_id,
			capability: agent_message_proposals.capability,
			target: agent_message_proposals.target,
			created_row: agent_message_proposals.created_row,
			applied_at: agent_message_proposals.applied_at,
			// Taken back since, from the card's receipt or the changes feed. An
			// entry the gate logged is undone far more often than a clicked one,
			// and a model told it is still there goes on citing it.
			undone_at: capability_edits.reverted_at
		})
		.from(agent_message_proposals)
		.leftJoin(capability_edits, eq(capability_edits.proposal_id, agent_message_proposals.id))
		.where(inArray(agent_message_proposals.message_id, messageIds))
		.orderBy(asc(agent_message_proposals.id));

	const byMessage = new Map<number, ProposalOutcome[]>();
	for (const row of rows) {
		const list = byMessage.get(row.message_id) ?? [];
		list.push({
			capability: row.capability,
			target: row.target,
			createdRow: row.created_row,
			applied: !!row.applied_at,
			undone: !!row.undone_at
		});
		byMessage.set(row.message_id, list);
	}
	return byMessage;
}

/** First line of the opening message, trimmed to a sane title length. */
export function deriveTitle(message: string): string {
	const firstLine = message.split('\n')[0].trim();
	return firstLine.length > 80 ? firstLine.slice(0, 77) + '…' : firstLine;
}

/**
 * What a turn's reads are replayed as, after its text, the way its proposal
 * outcomes are: one line naming each read, so a follow-up turn knows what the
 * assistant had in front of it and does not read it again to find out.
 */
export function renderReadsLine(reads: ReadRecord[] | undefined): string {
	if (!reads?.length) return '';
	const named = reads
		.filter((read) => read.ok && !read.fromMemo)
		.map((read) => {
			const ids = Object.values(read.args).filter((value) => typeof value === 'number');
			return ids.length > 0 ? `${read.tool} ${ids.join('/')}` : read.tool;
		});
	return named.length > 0 ? `\n\n(Read: ${named.join(', ')})` : '';
}

/**
 * The thread's recent turns, oldest first, each with what it proposed and
 * whether that happened, and what it read, after its text. The reads are on
 * the turn's first `ai_chats` row (retrieval.reads), which the assistant
 * message points at.
 */
export async function loadThreadHistory(conversationId: number): Promise<ChatMessage[]> {
	const past = (
		await db
			.select({
				id: agent_messages.id,
				role: agent_messages.role,
				content: agent_messages.content,
				retrieval: ai_chats.retrieval
			})
			.from(agent_messages)
			.leftJoin(ai_chats, eq(ai_chats.id, agent_messages.ai_chat_id))
			.where(eq(agent_messages.conversation_id, conversationId))
			.orderBy(desc(agent_messages.id))
			.limit(MAX_CONTEXT_MESSAGES)
	).reverse();

	const outcomes = past.length > 0 ? await readProposalOutcomes(past.map((m) => m.id)) : new Map();

	return past.map((m) => ({
		role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
		content:
			m.content +
			renderProposalOutcomes(outcomes.get(m.id) ?? []) +
			renderReadsLine((m.retrieval as RetrievalRecord | null)?.reads)
	}));
}
