/**
 * Writing, without the card's Apply click, the timeline entries a chat turn
 * proposed for something the applicant has just reported
 * (planning/LOG-AS-YOU-GO.md, Phase 2).
 *
 * `direct-writes.ts` decides; this does what it decided, and records why
 * whatever it left alone stayed a card. It runs after the turn's proposals are
 * stored, because a direct write is an applied proposal like any other: the
 * same row, the same edit-log link, the same undo. All the rest of the app sees
 * is `disposition = 'direct'` and an `applied_at` nobody clicked for.
 *
 * Off unless `SJS_ASSISTANT_DIRECT_LOGS` is set. And even then only for a turn
 * that came with the chat client's paste marks: without them the applicant's
 * own words cannot be told from a pasted document's, and the gate would be
 * reading the one thing it exists to ignore. Measured in Phase 0, where a paste
 * with no mail shape got through `framing()` alone.
 */
import { and, eq, isNotNull, max, sql } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { agent_message_proposals, agent_messages, capability_edits } from '$lib/server/db/schema';
import { config } from '$lib/server/config';
import { recentDirectWrites } from '$lib/server/mcp/burst';
import { DIRECT_WRITE_BURST } from '$lib/server/mcp/tiers';
import { type CapabilityActor, executeCapability } from './capabilities';
import { chatDisposition, type DirectWriteRule } from './direct-writes';

/** The one capability this can write. No other proposal is asked about. */
const LOGGABLE = 'add_activity_record';

/**
 * What became of one proposal, as stored in `agent_message_proposals.disposition`:
 * `direct`, the gate's rule for a card, `unmarked` for a turn without paste
 * marks, or `refused` when the gate passed it and the write turned it down.
 */
export type Disposition =
	'direct' | Exclude<DirectWriteRule, 'capability'> | 'unmarked' | 'refused';

/** One of the turn's proposals, as stored a moment ago. */
export interface TurnProposal {
	/** Its `agent_message_proposals` row. */
	id: number;
	capability: string;
	fields: Record<string, unknown>;
	target: { id: number; label: string };
}

export interface DirectLogTurn {
	actor: CapabilityActor;
	conversationId: number;
	/** The applicant's message. */
	message: string;
	/** The client's paste marks. Undefined when it sent none. */
	pasted: readonly string[] | undefined;
	/** The reply the proposals came with, as stored. */
	reply: string;
	proposals: TurnProposal[];
}

export interface DirectLogOutcome {
	disposition: Disposition;
	/** Set only for a direct write. */
	written?: {
		appliedAt: Date;
		createdRow: { id: number; label: string } | null;
		editId: number | null;
	};
}

/**
 * When an entry from this thread last landed on each application, applied by
 * a click or written directly. One query for the thread, read before anything
 * below writes.
 */
async function lastThreadLogs(conversationId: number): Promise<Map<number, Date>> {
	const application = sql<number>`(${agent_message_proposals.target}->>'id')::int`;
	const rows = await db
		.select({ application, at: max(agent_message_proposals.applied_at) })
		.from(agent_message_proposals)
		.innerJoin(agent_messages, eq(agent_message_proposals.message_id, agent_messages.id))
		.where(
			and(
				eq(agent_messages.conversation_id, conversationId),
				eq(agent_message_proposals.capability, LOGGABLE),
				isNotNull(agent_message_proposals.applied_at)
			)
		)
		.groupBy(application);
	return new Map(
		rows.filter((row) => row.at !== null).map((row) => [Number(row.application), row.at as Date])
	);
}

/**
 * Ask the gate about every loggable proposal of a turn, write the ones it
 * passes, and store each one's disposition. Returns them by proposal id; a
 * proposal it never asked about is absent.
 *
 * A write the capability refuses (rights lost, a value it will not take) is
 * left a card rather than an error on the reply: the applicant still gets the
 * entry to apply, and the reply they are reading is not wrong.
 */
export async function logReportedEvents(
	turn: DirectLogTurn
): Promise<Map<number, DirectLogOutcome>> {
	const outcomes = new Map<number, DirectLogOutcome>();
	if (!config.assistantDirectLogs) return outcomes;

	const loggable = turn.proposals.filter((p) => p.capability === LOGGABLE);
	if (loggable.length === 0) return outcomes;

	if (turn.pasted === undefined) {
		for (const p of loggable) outcomes.set(p.id, { disposition: 'unmarked' });
	} else {
		// Both asked once, before the first write. An entry this turn logs is not a
		// reason to card the next one from the same message, which by the
		// capability's own contract is a different thing that happened. The burst
		// ceiling does count this turn's writes, locally.
		const [lastLogged, recent] = await Promise.all([
			lastThreadLogs(turn.conversationId),
			recentDirectWrites(turn.actor.profileId)
		]);
		const now = new Date();
		let written = 0;

		for (const p of loggable) {
			const decision = chatDisposition({
				capability: p.capability,
				fields: p.fields,
				turn: turn.message,
				pasted: turn.pasted,
				reply: turn.reply,
				lastThreadLogAt: lastLogged.get(p.target.id) ?? null,
				now,
				overBurst: recent + written >= DIRECT_WRITE_BURST
			});
			if (decision.disposition === 'card') {
				// `capability` cannot come back: only the loggable one gets here.
				if (decision.rule !== 'capability') outcomes.set(p.id, { disposition: decision.rule });
				continue;
			}

			const result = await executeCapability(LOGGABLE, p.target, turn.actor, p.fields, 'chat');
			if (!result.ok) {
				console.warn(
					`[direct-log] proposal ${p.id} passed the gate, write refused: ${result.error}`
				);
				outcomes.set(p.id, { disposition: 'refused' });
				continue;
			}
			written++;

			const appliedAt = new Date();
			// What the apply endpoint writes for a click, so nothing downstream has to
			// know the difference: the before-image, the row the add made, and the
			// edit log's link back to this proposal for the undo.
			await db
				.update(agent_message_proposals)
				.set({
					applied_at: appliedAt,
					previous: result.previous,
					created_row: result.created,
					disposition: 'direct'
				})
				.where(eq(agent_message_proposals.id, p.id));
			if (result.editId) {
				await db
					.update(capability_edits)
					.set({ proposal_id: p.id })
					.where(eq(capability_edits.id, result.editId));
			}
			outcomes.set(p.id, {
				disposition: 'direct',
				written: { appliedAt, createdRow: result.created, editId: result.editId }
			});
			console.info(`[direct-log] proposal ${p.id} written directly (${decision.report})`);
		}
	}

	// The cards' reasons, stored for the trial: which rule cost which click.
	for (const [id, outcome] of outcomes) {
		if (outcome.disposition === 'direct') continue;
		await db
			.update(agent_message_proposals)
			.set({ disposition: outcome.disposition })
			.where(eq(agent_message_proposals.id, id));
	}

	return outcomes;
}
