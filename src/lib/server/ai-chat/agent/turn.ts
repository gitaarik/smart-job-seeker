/**
 * The assistant's turn, for real: what the graph's nodes do with the
 * database, the model and the registry (planning/ASSISTANT-AGENT.md § The
 * turn is the graph). graph.ts is the loop and its caps; this is its I/O, as
 * ScraperAgentDeps is the scraper agent's, so the loop is tested with a
 * scripted model and this with the route.
 */
import { eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import {
	agent_conversations,
	agent_message_proposals,
	agent_messages,
	ai_chats
} from '$lib/server/db/schema';
import { generateChatCompletionTracked } from '$lib/server/llm';
import {
	CAPABILITIES,
	type Capability,
	describeProposalChanges,
	type LiveCapability,
	type ProposedChange
} from '$lib/server/ai-chat/capabilities';
import type { CapabilityRecord } from '$lib/server/ai-chat/capability-record';
import { resolveChatContext } from '$lib/server/ai-chat/chat-context';
import { type DirectLogOutcome, logReportedEvents } from '$lib/server/ai-chat/direct-log';
import {
	AGENT_MANIFEST_BUDGET_CHARS,
	MANIFEST_BUDGET_CHARS
} from '$lib/server/ai-chat/activity-manifest';
import { DEFAULT_BUDGET_CHARS } from '$lib/server/ai-chat/generation-context';
import type { ContextEntity } from '$lib/server/ai-chat/generation-context';
import { ASSISTANT_PROFILE_FIELDS } from '$lib/server/ai-chat/profile-fields';
import { summarizeProposal } from '$lib/server/ai-chat/proposal-summary';
import { type PromptTemplate, promptTemplates } from '$lib/server/ai-chat/prompt-templates';
import { promptVariables } from '$lib/server/ai-chat/render-prompt';
import {
	type AssembledGeneration,
	assembleGeneration,
	recordCall
} from '$lib/server/ai-chat/utils';
import type { ReadRecord, RetrievalRecord } from '$lib/server/documents/retrieval-record';
import { scoreGeneration } from '$lib/server/monitoring/product-scores';
import { traceStep } from '$lib/server/monitoring/telemetry';
import { TurnExecutor } from './executor';
import type { TurnEvent } from './events';
import {
	type AssistantTurnDeps,
	type Finished,
	type ModelCall,
	type Prepared,
	runAssistantTurn,
	streamAssistantTurn
} from './graph';
import { deriveTitle, loadThreadHistory } from './history';
import { dedupeProposals, type StoredProposal } from './proposals';
import { chatToolSet } from './tools';

/** The agent's template. Its own key for the trial; see prompt-templates.ts. */
export const ASSISTANT_AGENT_PROMPT = 'personal_agent_chat_agent';

/**
 * What a page's tool definitions may come to, as the JSON the provider is
 * sent: the ratchet the prose block's 24,000 chars re-base to, recorded on
 * every turn (capabilityRecord.chars) and measured per page by
 * scripts/measure-capability-budget.ts. Measured 2026-10-17 on profile 1:
 * 28,812 on an application page with 18 tools, 21,294 to 25,685 on a job
 * page, and 39,569 on the busiest role page, where every parent-owned
 * tool (an achievement, a technology, a project under a role) repeats the
 * list of roles its parent field may name, which the prose block printed
 * once. Printing it once, or only the page's own role on a role page, is
 * the tunable that brings that page down; until then the ratchet sits above
 * it. A capability's contract that grows shows up here first.
 *
 * 41,500 since 2026-10-24, when a project's own role took that page from
 * 39,745 to 40,967. The field's note is the smaller part of that: a column
 * that prints in other languages also gets a property per language the
 * profile translates into, on every tool that writes it.
 */
export const TOOL_DEFINITIONS_BUDGET_CHARS = 41_500;

export interface TurnInput {
	userId: string;
	profileId: number;
	isStaff: boolean;
	/** The thread, when the message continues one. */
	conversation: { id: number; title: string | null } | null;
	/** The thread's id: the existing one, or the one reserved for a new thread. */
	conversationId: number;
	/** The id reserved for the turn's first ai_chats row, which the trace is seeded from. */
	aiChatId: number;
	message: string;
	route: string | null | undefined;
	routeParams: Record<string, string>;
	pasted: readonly string[] | undefined;
}

/** One proposal as the panel renders it: the card. */
export interface ProposalCard {
	id: number;
	capability: string;
	title: string;
	rationale: string;
	target: { id: number; label: string };
	changes: ProposedChange[];
	summary: string;
	applied_at: string | null;
	disposition: DirectLogOutcome['disposition'] | null;
	undone_at: null;
}

export interface TurnOutcome {
	reply: string;
	conversation: { id: number; title: string | null };
	messageId: number;
	proposals: ProposalCard[];
	reads: ReadRecord[];
	capabilityRecord: CapabilityRecord;
	/** The turn's first row. */
	aiChatId: number;
	rounds: number;
	capped: string | null;
}

export interface AgentPrepared extends Prepared {
	input: TurnInput;
	assembled: AssembledGeneration;
	capabilities: LiveCapability[];
	capabilityRecord: CapabilityRecord;
	toolNames: { reads: string[]; writes: string[] };
	executor: TurnExecutor;
}

/**
 * The page's own rows, named for the tools that take an id: the one place the
 * model learns which application or job it is standing on, since the write
 * tools ask for the id every time and the prompt's blocks are prose.
 */
export function pageIdsLine(entity: ContextEntity | undefined, live: LiveCapability[]): string {
	if (!entity) {
		return (
			'This page is about no one job or application. For a tool that takes an id, ' +
			'use one the sections below or the list tools give you.'
		);
	}
	if (entity.type === 'application') {
		const job = live.find((c) => c.capability.startsWith('edit_job_'))?.targets[0]?.id;
		return (
			`The page's own ids, for the tools that take one: application ${entity.id}` +
			`${job ? ` (its posting is job ${job})` : ''}.`
		);
	}
	if (entity.type === 'job') {
		return `The page's own ids, for the tools that take one: job ${entity.id}.`;
	}
	return (
		`The page's own ids, for the tools that take one: ${entity.resource} entry ` +
		`${entity.id} (its entry_id).`
	);
}

/** "" for every placeholder, beneath what the turn fills; see GenerationOptions.placeholderDefaults. */
function blankDefaults(template: PromptTemplate): Record<string, string> {
	return Object.fromEntries(
		promptVariables(`${template.system_prompt}\n${template.user_prompt}`).map((name) => [name, ''])
	);
}

const EMPTY_RETRIEVAL: RetrievalRecord = {
	requested: [],
	used: [],
	dropped: [],
	empty: [],
	chars: {},
	profileChars: 0,
	budgetChars: 0,
	rankers: {},
	items: []
};

function card(
	proposal: StoredProposal,
	id: number,
	outcome: DirectLogOutcome | undefined
): ProposalCard {
	const capability = proposal.capability as Capability;
	const title = CAPABILITIES[capability].title;
	// Paired with the values captured when the proposal was made, so the card
	// renders a diff, and the same one after it is applied.
	const changes = describeProposalChanges(capability, proposal.fields, proposal.previous);
	const appliedAt = outcome?.written?.appliedAt ?? null;
	return {
		id,
		capability: proposal.capability,
		title,
		rationale: proposal.rationale,
		target: proposal.target,
		changes,
		// The same edit as prose, for everything that is not a card.
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
}

export function assistantTurnDeps(): AssistantTurnDeps<TurnInput, TurnOutcome, AgentPrepared> {
	return {
		async prepare(input) {
			const history = input.conversation ? await loadThreadHistory(input.conversation.id) : [];

			// What the user is looking at, and what may be changed there — both
			// resolved server-side from the route and authorized against this
			// profile. `route` is client-supplied, so nothing derived from it is
			// taken on trust.
			const { context, capabilities, capabilityRecord } = await traceStep(
				'resolve_capabilities',
				'span',
				() =>
					resolveChatContext({
						routeId: input.route,
						params: input.routeParams,
						profileId: input.profileId,
						isStaff: input.isStaff,
						message: input.message,
						// Only the user's own turns: what the assistant said is not the
						// user asking for it.
						history: history.filter((m) => m.role === 'user').map((m) => m.content)
					}),
				(resolved) => ({
					input: { route: input.route, params: input.routeParams },
					output: resolved.capabilityRecord
				})
			);

			const template = promptTemplates[ASSISTANT_AGENT_PROMPT];
			const assembled = await assembleGeneration(
				input.profileId,
				ASSISTANT_AGENT_PROMPT,
				{ message: input.message, pageIds: pageIdsLine(context.entity, capabilities) },
				{
					profileDataFields: ASSISTANT_PROFILE_FIELDS,
					context: {
						...context,
						// The index for a reader with the read tools: its application
						// lines say what the budget left out. See ManifestReader.
						sourceOptions: { ...context.sourceOptions, activity_manifest: { reader: 'agent' } },
						// The agent's index is larger (AGENT_MANIFEST_BUDGET_CHARS), and the
						// evidence budget grows by the same amount so it squeezes out none of
						// the job, the activity or the ranked blocks beside it.
						budgetChars:
							(context.budgetChars ?? DEFAULT_BUDGET_CHARS) +
							(AGENT_MANIFEST_BUDGET_CHARS - MANIFEST_BUDGET_CHARS)
					},
					placeholderDefaults: blankDefaults(template)
				}
			);
			if (!assembled.ok) throw new Error(assembled.message);

			const actor = { profileId: input.profileId, isStaff: input.isStaff };
			// An application whose employer reads it without names: the profile the
			// model holds has had the identity taken out, and the executor keeps it
			// out of every read (never so for the chat as it is; see
			// writingAnonymity).
			const identity = assembled.anonymity?.strip ? assembled.anonymity.identity : null;
			const tools = await chatToolSet(capabilities, actor, { anonymous: !!identity });
			const executor = new TurnExecutor({ actor, live: capabilities, identity });

			return {
				input,
				system: assembled.systemPrompt,
				history,
				user: assembled.userPrompt,
				tools: tools.definitions,
				execute: (call) => executor.execute(call),
				executor,
				assembled,
				capabilities,
				// The record the prose block kept, with the size of what replaced it.
				capabilityRecord: {
					...capabilityRecord,
					chars: JSON.stringify(tools.definitions).length,
					budgetChars: TOOL_DEFINITIONS_BUDGET_CHARS
				},
				toolNames: { reads: tools.reads, writes: tools.writes }
			};
		},

		async callModel(prepared, call: ModelCall) {
			const first = call.round === 1;
			const { assembled, input } = prepared;
			const { aiChatId, result } = await recordCall({
				profileId: input.profileId,
				assembled,
				// The first call takes the id the route reserved, which the trace is
				// seeded from and the assistant message points at; the later ones
				// count under it.
				aiChatId: first ? input.aiChatId : undefined,
				parentId: first ? null : call.firstAiChatId,
				capabilityRecord: first ? prepared.capabilityRecord : null,
				// The bulky columns once, on the first row.
				context: first ? undefined : null,
				retrieval: first ? undefined : null,
				// The first row's full prompt is the turn's as it started; a later
				// row's shows the rounds so far, with the message among them.
				historyMessages: first ? prepared.history : call.messages.slice(1),
				call: () =>
					generateChatCompletionTracked(call.messages, {
						tools: prepared.tools,
						toolChoice: call.toolChoice,
						provider: assembled.route.provider,
						model: assembled.route.model,
						fallback: assembled.fallback,
						temperature: assembled.template.temperature,
						promptKey: ASSISTANT_AGENT_PROMPT,
						cache: false
					})
			});
			return { aiChatId, result };
		},

		async finish(input, prepared, done: Finished) {
			const now = new Date();
			const actor = { profileId: input.profileId, isStaff: input.isStaff };

			// Persist only now that there is a reply: create the thread on its first
			// message, otherwise bump its activity timestamp.
			let conversation = input.conversation;
			if (!conversation) {
				const [created] = await db
					.insert(agent_conversations)
					.values({
						id: input.conversationId,
						user_id: input.userId,
						profile_id: input.profileId,
						title: deriveTitle(input.message),
						date_created: now,
						last_message_at: now
					})
					.returning({ id: agent_conversations.id, title: agent_conversations.title });
				conversation = created;
			} else {
				await db
					.update(agent_conversations)
					.set({ last_message_at: now })
					.where(eq(agent_conversations.id, conversation.id));
			}

			// One insert for the exchange (a half-written one is worse than none),
			// returning, because the assistant row's id is what the cards hang off.
			const firstAiChatId = done.aiChatIds[0];
			const [, assistantMessage] = await db
				.insert(agent_messages)
				.values([
					{
						conversation_id: conversation.id,
						role: 'user',
						content: input.message,
						profile_id: input.profileId,
						date_created: now
					},
					{
						conversation_id: conversation.id,
						role: 'assistant',
						content: done.reply,
						profile_id: input.profileId,
						ai_chat_id: firstAiChatId,
						date_created: now
					}
				])
				.returning({ id: agent_messages.id });

			// One card per capability and row, each with the row of the call that
			// made it, which its scores go on.
			const kept = new Set(dedupeProposals(done.proposed.map((p) => p.proposal)));
			const proposals = done.proposed.filter((p) => kept.has(p.proposal));
			const stored =
				proposals.length > 0
					? await db
							.insert(agent_message_proposals)
							.values(
								proposals.map(({ proposal }) => ({
									message_id: assistantMessage.id,
									capability: proposal.capability,
									rationale: proposal.rationale,
									fields: proposal.fields,
									previous: proposal.previous,
									target: proposal.target,
									date_created: now
								}))
							)
							.returning({ id: agent_message_proposals.id })
					: [];

			// The reads, on the turn's first row beside what retrieval put in front
			// of the model, where the record outlives the prompt.
			if (done.reads.length > 0) {
				const retrieval: RetrievalRecord = {
					...(prepared.assembled.retrieval ?? EMPTY_RETRIEVAL),
					reads: done.reads
				};
				await db.update(ai_chats).set({ retrieval }).where(eq(ai_chats.id, firstAiChatId));
			}

			// The gate that may write an entry for something the applicant just
			// reported without the card's click (direct-log.ts). A failure here
			// leaves every proposal a card rather than failing a turn whose reply is
			// already stored.
			let direct = new Map<number, DirectLogOutcome>();
			try {
				direct = await logReportedEvents({
					actor,
					conversationId: conversation.id,
					message: input.message,
					pasted: input.pasted,
					reply: done.reply,
					proposals: proposals.map(({ proposal }, i) => ({
						id: stored[i].id,
						capability: proposal.capability,
						fields: proposal.fields,
						target: proposal.target
					}))
				});
			} catch (e) {
				console.error('[agent] direct logging failed, every proposal stays a card', e);
			}

			// Each starts unapplied, so the turn's apply rate counts the ones never
			// taken; a direct write is scored applied here, once. On the generation
			// that made the proposal's call.
			proposals.forEach(({ aiChatId }, i) => {
				const { id } = stored[i];
				const written = direct.get(id)?.written;
				scoreGeneration(aiChatId, 'proposal_applied', `proposal:${id}`, !!written);
				if (written?.editId) {
					scoreGeneration(aiChatId, 'edit_undone', `edit:${written.editId}`, false);
				}
			});

			return {
				reply: done.reply,
				conversation,
				messageId: assistantMessage.id,
				proposals: proposals.map(({ proposal }, i) =>
					card(proposal, stored[i].id, direct.get(stored[i].id))
				),
				reads: done.reads,
				capabilityRecord: prepared.capabilityRecord,
				aiChatId: firstAiChatId,
				rounds: done.rounds,
				capped: done.capped
			};
		}
	};
}

/** One turn of the assistant, start to finish. The route calls this with the flag on. */
export function runTurn(input: TurnInput): Promise<TurnOutcome> {
	return runAssistantTurn(assistantTurnDeps(), input);
}

/** The same turn, with its steps and tool calls told to the panel as they happen. */
export function streamTurn(
	input: TurnInput,
	onEvent: (event: TurnEvent) => void
): Promise<TurnOutcome> {
	return streamAssistantTurn(assistantTurnDeps(), input, onEvent);
}
