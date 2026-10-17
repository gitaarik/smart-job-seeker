import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
	agent_conversations,
	agent_message_proposals,
	agent_messages,
	capability_edits
} from '$lib/server/db/schema';
import { requireAuth, requireProfileAccess } from '$lib/server/utils/api-helpers';
import { agentChatSchema, parseBody } from '$lib/server/validation/api-schemas';
import { requireCredits } from '$lib/server/billing/require-credits';
import type { ChatMessage } from '$lib/server/llm';
import {
	createAndGenerateAiChat,
	reserveAiChatId,
	reserveConversationId
} from '$lib/server/ai-chat/utils';
import { resolveChatContext } from '$lib/server/ai-chat/chat-context';
import { EMPTY_CONTEXT_VARIABLES } from './placeholders';
import { isStaffUser } from './scope';
import {
	type CapabilityActor,
	buildProposalSchema,
	CAPABILITIES,
	type Capability,
	describeProposalChanges,
	type LiveCapability,
	liveLanguages,
	renderCapabilityPrompt
} from '$lib/server/ai-chat/capabilities';
import {
	dedupeProposals,
	type ProposalCandidate,
	readProposal,
	renderDropNotice,
	type StoredProposal,
	traceProposal
} from '$lib/server/ai-chat/agent/proposals';
import { summarizeProposal } from '$lib/server/ai-chat/proposal-summary';
import {
	type ProposalOutcome,
	renderProposalOutcomes
} from '$lib/server/ai-chat/proposal-outcomes';
import { ASSISTANT_PROFILE_FIELDS } from '$lib/server/ai-chat/profile-fields';
import { type DirectLogOutcome, logReportedEvents } from '$lib/server/ai-chat/direct-log';
import { aiChatTraceSeed, startTrace, traceStep } from '$lib/server/monitoring/telemetry';
import { scoreGeneration } from '$lib/server/monitoring/product-scores';

// Recent turns sent to the model as context (~20 user/assistant exchanges).
// Older turns are dropped; summarization can be layered on later if needed.
const MAX_CONTEXT_MESSAGES = 40;

/**
 * What each of a window's turns proposed and whether it was applied, grouped by
 * turn.
 *
 * Read straight from the proposal rows rather than through the transcript
 * endpoint's richer shape: this needs the fate of a proposal, not its diff, and
 * rebuilding the diffs would mean a `current` read per proposal per turn — the
 * expensive half of that endpoint, spent to produce something no one reads.
 */
async function readProposalOutcomes(messageIds: number[]): Promise<Map<number, ProposalOutcome[]>> {
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
function deriveTitle(message: string): string {
	const firstLine = message.split('\n')[0].trim();
	return firstLine.length > 80 ? firstLine.slice(0, 77) + '…' : firstLine;
}

/**
 * Field-by-field diff for the card, using the values captured when the
 * proposal was made.
 *
 * Diffed against the proposal's own `previous` rather than off the live
 * capability. `previous` is already the before-image of exactly these fields on
 * exactly this row, so it is both cheaper than a re-read and correct on a list
 * page — where a capability is live over several rows and has no single set of
 * current values, and pairing one row's edit with another row's values would
 * show the user a "from" they never had.
 */
function describeChanges(proposal: StoredProposal) {
	return describeProposalChanges(
		proposal.capability as Capability,
		proposal.fields,
		proposal.previous
	);
}

/**
 * Read a structured reply, keeping the message even when the proposals are
 * unusable.
 *
 * Every failure here degrades to "reply, fewer proposals" rather than failing
 * the turn. The user asked a question and the model answered it; a malformed or
 * unauthorized edit suggestion is not a reason to show them an error, and
 * dropping it is the conservative direction — the worst case is that a change
 * they wanted isn't offered, and they ask again.
 *
 * Dropping it *silently* was not, which is what this used to do. "They ask
 * again" only works if they know there is something to ask again for, and the
 * reply routinely describes the change that just vanished. So every drop
 * carries a reason and the reasons are appended to the reply.
 *
 * Each entry is judged on its own: one bad proposal in a pair does not take the
 * good one down with it, which is the point of them being separate cards.
 */
async function readCapableReply(
	raw: string,
	live: LiveCapability[],
	actor: CapabilityActor
): Promise<{ reply: string; proposals: StoredProposal[] }> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		// Structured output was requested but didn't come back as JSON. The text
		// is still the assistant's answer.
		return { reply: raw, proposals: [] };
	}

	// Valid JSON that isn't an object — null, an array, a bare number. `null` is
	// the one that happened: a failed structured generation reached here as the
	// literal string "null", which JSON.parse accepts, and reading `.reply` off
	// it threw. A function whose entire contract is "degrade rather than fail
	// the turn" was the one place that 500'd.
	//
	// The root cause is fixed in the LLM layer, which now treats a null parse as
	// the failed generation it is. This stays because the guarantee belongs here
	// too: whatever a model returns, the user gets an answer or a clean error,
	// never a stack trace.
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return { reply: raw, proposals: [] };
	}

	const body = parsed as {
		reply?: unknown;
		proposals?: unknown;
	};
	const reply = typeof body.reply === 'string' && body.reply.trim() ? body.reply : raw;

	const candidates = Array.isArray(body.proposals) ? body.proposals : [];
	const read = await Promise.all(
		candidates.map((c) =>
			traceProposal(c as ProposalCandidate, () => readProposal(c as ProposalCandidate, live, actor))
		)
	);
	const drops = read.filter((r) => !r.ok).map((r) => r.drop);
	const proposals = dedupeProposals(read.filter((r) => r.ok).map((r) => r.proposal));

	const notice = renderDropNotice(drops);
	return {
		// Appended to the reply itself rather than returned beside it, so it is
		// persisted with the message. Two things follow that a separate field
		// wouldn't give: reloading a 12h-resumable thread shows the same thing the
		// live turn did, and the next turn replays the note to the model as its own
		// words — so a retry starts out knowing which change was rejected and why.
		reply: notice ? `${reply}\n\n${notice}` : reply,
		proposals
	};
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);

	const { profile_id, conversation_id, message, route, routeParams, pasted } = parseBody(
		agentChatSchema,
		await request.json()
	);

	await requireProfileAccess(profile_id, user.id);
	// Same as every other generation endpoint. The chat was priced at 1 when it
	// was a profile blob and a question; it now assembles the same evidence and
	// calls the same writing model as a cover letter, so it costs the same.
	await requireCredits(user.id, 5);

	// Resolve the target conversation up front (ownership-checked). A new thread
	// is created lazily only after a successful reply, below.
	//
	// Matched on the profile as well as the user: a thread is conducted AS a
	// profile, and every turn in it is answered from that profile's material and
	// stamped with its id. Appending a turn under a different profile produced a
	// thread that was half one applicant and half another, with nothing in the
	// transcript marking where it changed hands.
	let conversation: { id: number; title: string | null } | undefined;
	if (conversation_id != null) {
		const [existing] = await db
			.select({ id: agent_conversations.id, title: agent_conversations.title })
			.from(agent_conversations)
			.where(
				and(
					eq(agent_conversations.id, conversation_id),
					eq(agent_conversations.user_id, user.id),
					eq(agent_conversations.profile_id, profile_id)
				)
			)
			.limit(1);
		if (!existing) {
			return json({ success: false, message: 'Conversation not found.' }, { status: 404 });
		}
		conversation = existing;
	}

	// Prior turns (oldest → newest), capped to the recent window. The new message
	// isn't persisted yet, so it isn't included here.
	const past = conversation
		? (
				await db
					.select({
						id: agent_messages.id,
						role: agent_messages.role,
						content: agent_messages.content
					})
					.from(agent_messages)
					.where(eq(agent_messages.conversation_id, conversation.id))
					.orderBy(desc(agent_messages.id))
					.limit(MAX_CONTEXT_MESSAGES)
			).reverse()
		: [];

	// What each of those turns proposed, and whether it happened. Replayed with
	// the turn because otherwise it isn't replayed at all: a model reading its own
	// prose back has no way to tell a draft it offered from a row that exists, and
	// re-proposing an accepted add is what that costs. See proposal-outcomes.ts.
	//
	// One query for the window rather than one per turn, and only for a thread
	// that has one — the same shape the transcript endpoint uses.
	const outcomes: Map<number, ProposalOutcome[]> =
		past.length > 0 ? await readProposalOutcomes(past.map((m) => m.id)) : new Map();

	const history: ChatMessage[] = past.map((m) => ({
		role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
		content: m.content + renderProposalOutcomes(outcomes.get(m.id) ?? [])
	}));

	// The turn's root trace (planning/LANGFUSE.md § Trace model), seeded from its
	// ai_chats row, whose id is reserved first so the trace can be found from the
	// row. It covers what the turn may change, the generation and each proposal,
	// and shows the user's message and the reply, which is what a reviewer reads.
	// A new thread's id is reserved as well, so its first turn is in its session.
	const isStaff = isStaffUser(user);
	const aiChatId = await reserveAiChatId();
	const conversationId = conversation?.id ?? (await reserveConversationId());
	const turn = await startTrace(
		{
			name: 'answer_message',
			kind: 'agent',
			seed: aiChatTraceSeed(aiChatId),
			userId: user.id,
			sessionId: `assistant:${conversationId}`,
			metadata: { profile_id: String(profile_id) },
			input: message
		},
		async () => {
			// What the user is looking at, and what may be changed there — both resolved
			// server-side from the route and authorized against this profile. `route` is
			// client-supplied, so nothing derived from it is taken on trust.
			const { context, capabilities, capabilityRecord } = await traceStep(
				'resolve_capabilities',
				'span',
				() =>
					resolveChatContext({
						routeId: route,
						params: routeParams ?? {},
						profileId: profile_id,
						isStaff,
						message,
						// Only the user's own turns. What the assistant said is not the user
						// asking for it — it names sections all the time ("that's on your
						// Languages page"), and matching on its own suggestions would let the
						// assistant talk itself into a capability nobody requested.
						history: history.filter((m) => m.role === 'user').map((m) => m.content)
					}),
				(resolved) => ({
					input: { route, params: routeParams ?? {} },
					output: resolved.capabilityRecord
				})
			);

			// Turns with nothing to propose keep the original plain-text path exactly:
			// same prompt, no schema, no capability block, no extra tokens. Only a page
			// where the user can actually change something pays for the structured one.
			const capable = capabilities.length > 0;
			const result = await createAndGenerateAiChat(
				profile_id,
				capable ? 'personal_agent_chat_capable' : 'personal_agent_chat',
				{
					message,
					...(capable ? { capabilities: renderCapabilityPrompt(capabilities) } : {})
				},
				undefined,
				{
					profileDataFields: ASSISTANT_PROFILE_FIELDS,
					context,
					// Stored on the row whether or not anything was admitted: a turn that
					// offered nothing is exactly the turn whose record explains why.
					capabilityRecord,
					// Fallbacks, NOT customVariables: passed as customVariables these blank
					// every source the line above just assembled, because customVariables are
					// the deliberate override. See placeholderDefaults in utils.ts.
					placeholderDefaults: EMPTY_CONTEXT_VARIABLES,
					aiChatId,
					// Prior turns replayed as real messages rather than recapped as a
					// transcript inside the prompt — same as the four editors.
					historyMessages: history,
					...(capable
						? {
								// Translation fields only in the languages the prompt offers them in.
								responseSchema: buildProposalSchema(
									capabilities.map((c) => c.capability),
									{ languages: liveLanguages(capabilities) }
								)
							}
						: {})
				}
			);

			if (!result.success || !result.aiChat?.response) {
				return { ok: false as const, message: result.message };
			}

			const { reply, proposals } = capable
				? await readCapableReply(result.aiChat.response, capabilities, {
						profileId: profile_id,
						isStaff
					})
				: { reply: result.aiChat.response, proposals: [] as StoredProposal[] };
			return { ok: true as const, aiChat: result.aiChat, reply, proposals, capabilityRecord };
		},
		(outcome) =>
			outcome.ok
				? { output: outcome.reply }
				: { statusMessage: outcome.message || 'The assistant could not respond.' }
	);

	if (!turn.ok) {
		return json(
			{
				success: false,
				message: turn.message || 'The assistant could not respond.'
			},
			{ status: 422 }
		);
	}

	const { aiChat, reply, proposals, capabilityRecord } = turn;
	const now = new Date();

	// Persist only now that we have a reply: create the thread on first message,
	// otherwise just bump its activity timestamp.
	if (!conversation) {
		const [created] = await db
			.insert(agent_conversations)
			.values({
				id: conversationId,
				user_id: user.id,
				profile_id,
				title: deriveTitle(message),
				date_created: now,
				last_message_at: now
			})
			.returning({
				id: agent_conversations.id,
				title: agent_conversations.title
			});
		conversation = created;
	} else {
		await db
			.update(agent_conversations)
			.set({ last_message_at: now })
			.where(eq(agent_conversations.id, conversation.id));
	}

	// Still one insert for the exchange itself (a half-written one is worse than
	// none), and returning, because the assistant row's id is what the proposals
	// hang off.
	const [, assistantMessage] = await db
		.insert(agent_messages)
		.values([
			{
				conversation_id: conversation.id,
				role: 'user',
				content: message,
				profile_id,
				date_created: now
			},
			{
				conversation_id: conversation.id,
				role: 'assistant',
				content: reply,
				profile_id,
				ai_chat_id: aiChat.id,
				date_created: now
			}
		])
		.returning({ id: agent_messages.id });

	// A row per proposal, and their ids are what the client posts back to apply
	// one — so they have to come out of the insert, not be derived from the
	// message. Skipped entirely when there is nothing to propose, which is the
	// overwhelmingly common turn.
	const stored =
		proposals.length > 0
			? await db
					.insert(agent_message_proposals)
					.values(
						proposals.map((p) => ({
							message_id: assistantMessage.id,
							capability: p.capability,
							rationale: p.rationale,
							fields: p.fields,
							previous: p.previous,
							target: p.target,
							date_created: now
						}))
					)
					.returning({ id: agent_message_proposals.id })
			: [];

	// The gate that may write an entry for something the applicant just reported
	// without the card's click (ai-chat/direct-log.ts). Off unless the flag is
	// set, and asked only about timeline entries; everything else is a card as
	// before. A failure here leaves every proposal a card rather than failing a
	// turn whose reply is already stored.
	let direct = new Map<number, DirectLogOutcome>();
	try {
		direct = await logReportedEvents({
			actor: { profileId: profile_id, isStaff },
			conversationId: conversation.id,
			message,
			pasted,
			reply,
			proposals: proposals.map((p, i) => ({
				id: stored[i].id,
				capability: p.capability,
				fields: p.fields,
				target: p.target
			}))
		});
	} catch (e) {
		console.error('[agent] direct logging failed, every proposal stays a card', e);
	}

	// Each starts unapplied, so the turn's apply rate counts the ones never taken.
	// A direct write is scored applied here, once: sending "unapplied" first and
	// "applied" after would be two writes of one score racing each other.
	for (const { id } of stored) {
		const written = direct.get(id)?.written;
		scoreGeneration(aiChat.id, 'proposal_applied', `proposal:${id}`, !!written);
		if (written?.editId) {
			scoreGeneration(aiChat.id, 'edit_undone', `edit:${written.editId}`, false);
		}
	}

	return json({
		success: true,
		reply,
		conversation_id: conversation.id,
		title: conversation.title,
		message_id: assistantMessage.id,
		// Why this turn could propose what it did. Staff only, and gated here
		// rather than in the component: what the page ships is the boundary, not
		// what it chooses to render.
		...(isStaff ? { capabilityRecord } : {}),
		proposals: await Promise.all(
			proposals.map(async (proposal, i) => {
				const title = CAPABILITIES[proposal.capability as keyof typeof CAPABILITIES].title;
				// Paired with the current value so the card renders a diff, not a
				// list of new values with no idea what they replace.
				const changes = describeChanges(proposal);
				const outcome = direct.get(stored[i].id);
				const appliedAt = outcome?.written?.appliedAt ?? null;
				return {
					id: stored[i].id,
					capability: proposal.capability,
					title,
					rationale: proposal.rationale,
					target: proposal.target,
					changes,
					// The same edit as prose. The card doesn't need it; everything that
					// isn't a card does — see proposal-summary.ts.
					summary: summarizeProposal({
						title,
						target: proposal.target,
						changes,
						rationale: proposal.rationale,
						applied: !!appliedAt
					}),
					applied_at: appliedAt?.toISOString() ?? null,
					// `direct` when the gate wrote it: the card is a receipt with an Undo.
					disposition: outcome?.disposition ?? null,
					undone_at: null
				};
			})
		)
	});
};
