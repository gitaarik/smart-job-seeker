/**
 * The assistant's turn as a LangGraph graph (planning/ASSISTANT-AGENT.md
 * § The turn is the graph).
 *
 *   START → prepare → agent ⇄ tools → finish → END
 *
 * `prepare` is what the route did before the model: the thread, the page's
 * context and capabilities, the prompt, the turn's tool set. `agent` is one
 * model call with the tools bound, which returns tool calls or the reply.
 * `tools` runs every requested call through the turn's executor: a read
 * through the MCP read tools, a write into a buffered proposal with a
 * receipt. The loop ends when the model writes a reply, or at a cap, where
 * the model is told so in the last tool result and gets one more call that
 * cannot call again. `finish` is what the route did after the model: the
 * exchange and the cards stored, the direct-log gate, the scores, the
 * payload. A turn that fails anywhere stores nothing.
 *
 * The nodes do their I/O through `AssistantTurnDeps`, so the loop and its caps
 * are tested with a scripted model (__tests__/graph.test.ts); turn.ts is the
 * real implementation. No checkpointer: the thread is the record, and the
 * interrupt is reserved for the first multi-step task (the plan, § Reserved).
 */
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { ChatMessage, CompletionResult, ToolCall, ToolDefinition } from '$lib/server/llm';
import type { ReadRecord } from '$lib/server/documents/retrieval-record';
import { isReadTool } from '$lib/server/mcp/tools';
import { traced } from '$lib/server/monitoring/langgraph';
import { glance, traceStep } from '$lib/server/monitoring/telemetry';
import type { ExecutedCall } from './executor';
import type { StoredProposal } from './proposals';

/**
 * Model calls per turn. The spike's longest honest turn took three: read the
 * log, read the entry, reply. The fourth is the reply a turn that is still
 * calling is held to.
 */
export const MAX_ROUNDS = 4;
/** Tool calls per turn, over every round: two subjects are two calls, a list and a read two more. */
export const MAX_TOOL_CALLS = 12;
/**
 * Characters of read results per turn: three slices and change, about 5,000
 * tokens on top of the 26,000 the prompt is, paid again on every round after.
 */
export const MAX_READ_CHARS = 20_000;
/** prepare, then agent and tools per round, then finish, with room to spare. */
const RECURSION_LIMIT = 2 * MAX_ROUNDS + 4;

/** What `prepare` hands the rest of the turn. The real one carries more (turn.ts). */
export interface Prepared {
	/** The system prompt, rendered. */
	system: string;
	/** The prior turns of the thread, as messages. */
	history: ChatMessage[];
	/** The user's message, as the prompt renders it. */
	user: string;
	tools: ToolDefinition[];
	execute(call: ToolCall): Promise<ExecutedCall>;
}

export interface ModelCall {
	messages: ChatMessage[];
	round: number;
	/** 'none' on the round that has to be the reply. */
	toolChoice: 'auto' | 'none';
	/** The turn's first row, which a later round's row counts under. */
	firstAiChatId: number | null;
}

export interface ModelAnswer {
	result: CompletionResult;
	/** The row the call was recorded on. */
	aiChatId: number;
}

/** A proposal, and the row of the model call that made it, which its scores go on. */
export interface Proposed {
	proposal: StoredProposal;
	aiChatId: number;
}

export interface Finished {
	reply: string;
	proposed: Proposed[];
	reads: ReadRecord[];
	/** One per model call, the first the turn's own. */
	aiChatIds: number[];
	rounds: number;
	/** The cap that ended the loop, when one did. */
	capped: string | null;
	messages: ChatMessage[];
}

export interface AssistantTurnDeps<Input, Outcome, P extends Prepared = Prepared> {
	prepare(input: Input): Promise<P>;
	callModel(prepared: P, call: ModelCall): Promise<ModelAnswer>;
	finish(input: Input, prepared: P, finished: Finished): Promise<Outcome>;
}

const last = <T>(_: T, value: T) => value;
const concat = <T>(previous: T[], added: T[]) => previous.concat(added);

export const AssistantTurnState = Annotation.Root({
	input: Annotation<unknown>,
	prepared: Annotation<Prepared | null>({ reducer: last, default: () => null }),
	/** The conversation as the model sees it: system, the thread, the message, then the rounds. */
	messages: Annotation<ChatMessage[]>({ reducer: concat, default: () => [] }),
	round: Annotation<number>({ reducer: last, default: () => 0 }),
	calls: Annotation<number>({
		reducer: (sum: number, added: number) => sum + added,
		default: () => 0
	}),
	readChars: Annotation<number>({
		reducer: (sum: number, added: number) => sum + added,
		default: () => 0
	}),
	reads: Annotation<ReadRecord[]>({ reducer: concat, default: () => [] }),
	proposed: Annotation<Proposed[]>({ reducer: concat, default: () => [] }),
	aiChatIds: Annotation<number[]>({ reducer: concat, default: () => [] }),
	/** The calls the last model call asked for, for `tools` to run. */
	pending: Annotation<ToolCall[]>({ reducer: last, default: () => [] }),
	capped: Annotation<string | null>({ reducer: last, default: () => null }),
	reply: Annotation<string | null>({ reducer: last, default: () => null }),
	outcome: Annotation<unknown>({ reducer: last, default: () => null })
});

export type TurnState = typeof AssistantTurnState.State;
/** What a node returns: plain values, which the reducers fold in. */
type TurnUpdate = Partial<TurnState>;

/** What the model is told in the last tool result when the turn cannot read any further. */
export function capNote(reason: string): string {
	return (
		`[This turn's reading is spent (${reason}). Answer now from what you have; ` +
		`you cannot call another tool on this turn.]`
	);
}

function preparedOf<P extends Prepared>(state: TurnState): P {
	if (!state.prepared) throw new Error('The turn was not prepared');
	return state.prepared as P;
}

/** Where a sliced read ended, from the line it prints when there is more. */
function offsetEndOf(content: string): number | undefined {
	const match = content.match(/Call again with offset (\d+)/);
	return match ? Number(match[1]) : undefined;
}

export function buildAssistantTurnGraph<Input, Outcome, P extends Prepared>(
	deps: AssistantTurnDeps<Input, Outcome, P>
) {
	const prepare = async (state: TurnState): Promise<TurnUpdate> => {
		const prepared = await deps.prepare(state.input as Input);
		return {
			prepared,
			messages: [
				{ role: 'system', content: prepared.system },
				...prepared.history,
				{ role: 'user', content: prepared.user }
			]
		};
	};

	const agent = async (state: TurnState): Promise<TurnUpdate> => {
		const prepared = preparedOf<P>(state);
		const round = state.round + 1;
		// The last round, or a cap reached in the one before: the model was told
		// so in the last tool result, and this call cannot call again.
		const toolChoice = round >= MAX_ROUNDS || state.capped ? 'none' : 'auto';
		const { result, aiChatId } = await deps.callModel(prepared, {
			messages: state.messages,
			round,
			toolChoice,
			firstAiChatId: state.aiChatIds[0] ?? null
		});
		const calls = result.toolCalls ?? [];
		if (calls.length === 0 || toolChoice === 'none') {
			return { round, aiChatIds: [aiChatId], pending: [], reply: result.content };
		}
		// Text beside the calls is discarded, from the reply and from the
		// history alike: replayed next to its call, it had the model make the
		// same call again every round (the spike, planning/ASSISTANT-AGENT.md
		// § The spike, Result). The reply is the text of the call that made none.
		return {
			round,
			aiChatIds: [aiChatId],
			pending: calls,
			messages: [
				{ role: 'assistant', content: '', toolCalls: calls, providerData: result.providerData }
			]
		};
	};

	const tools = async (state: TurnState): Promise<TurnUpdate> => {
		const prepared = preparedOf<P>(state);
		const round = state.round;
		const rowOfThisRound = state.aiChatIds[state.aiChatIds.length - 1];
		// Every requested call, in parallel. A read is a tool observation of its
		// own; a write traces itself as the proposal it becomes (proposals.ts).
		const executed = await Promise.all(
			state.pending.map((call) =>
				isReadTool(call.name)
					? traceStep(
							call.name,
							'tool',
							() => prepared.execute(call),
							(done) => ({
								input: call.args,
								output: { chars: done.chars, cut: done.cut, fromMemo: done.fromMemo },
								...(done.isError
									? { level: 'WARNING', statusMessage: glance(done.content, 200) }
									: {})
							})
						)
					: prepared.execute(call)
			)
		);

		const reads: ReadRecord[] = executed
			.filter((done) => done.kind === 'read')
			.map((done) => ({
				tool: done.call.name,
				args: done.call.args,
				chars: done.chars,
				...(offsetEndOf(done.content) !== undefined
					? { offsetEnd: offsetEndOf(done.content) }
					: {}),
				ms: done.ms,
				round,
				ok: !done.isError,
				...(done.fromMemo ? { fromMemo: true } : {})
			}));
		const proposed: Proposed[] = executed
			.filter((done) => done.proposal && !done.fromMemo)
			.map((done) => ({ proposal: done.proposal!, aiChatId: rowOfThisRound }));
		// What this round adds to the context: a memo hit repeats nothing.
		const chars = executed.reduce(
			(sum, done) => sum + (done.kind === 'read' && !done.fromMemo ? done.content.length : 0),
			0
		);
		const calls = state.calls + executed.length;
		const readChars = state.readChars + chars;
		const capped =
			round >= MAX_ROUNDS - 1
				? 'the last round'
				: calls >= MAX_TOOL_CALLS
					? `${MAX_TOOL_CALLS} tool calls`
					: readChars >= MAX_READ_CHARS
						? `${MAX_READ_CHARS.toLocaleString('en-US')} characters read`
						: null;

		const messages: ChatMessage[] = executed.map((done, i) => ({
			role: 'tool',
			toolCallId: done.call.id,
			name: done.call.name,
			content:
				capped && i === executed.length - 1
					? `${done.content}\n\n${capNote(capped)}`
					: done.content,
			isError: done.isError
		}));
		return {
			messages,
			calls: executed.length,
			readChars: chars,
			reads,
			proposed,
			capped,
			pending: []
		};
	};

	const finish = async (state: TurnState): Promise<TurnUpdate> => {
		const prepared = preparedOf<P>(state);
		if (!state.reply?.trim()) throw new Error('The assistant wrote no reply.');
		const outcome = await deps.finish(state.input as Input, prepared, {
			reply: state.reply,
			proposed: state.proposed,
			reads: state.reads,
			aiChatIds: state.aiChatIds,
			rounds: state.round,
			capped: state.capped,
			messages: state.messages
		});
		return { outcome };
	};

	return new StateGraph(AssistantTurnState)
		.addNode(
			'prepare',
			traced('prepare', 'span', prepare, {
				describe: (update) => ({
					output: {
						tools: update.prepared?.tools.map((tool) => tool.name),
						history: update.prepared?.history.length
					}
				})
			})
		)
		.addNode(
			'agent',
			traced('agent', 'span', agent, {
				describe: (update) => ({
					output: {
						round: update.round,
						calls: update.pending?.map((call) => call.name) ?? [],
						...(update.reply ? { reply: glance(update.reply) } : {})
					}
				})
			})
		)
		.addNode(
			'tools',
			traced('tools', 'span', tools, {
				describe: (update) => ({
					output: {
						reads: update.reads?.map((read) => `${read.tool} ${read.chars}`),
						proposed: update.proposed?.map((p) => p.proposal.capability),
						capped: update.capped
					}
				})
			})
		)
		.addNode('finish', traced('finish', 'span', finish, { describe: () => ({ output: 'stored' }) }))
		.addEdge(START, 'prepare')
		.addEdge('prepare', 'agent')
		.addConditionalEdges('agent', (state) => (state.pending.length > 0 ? 'tools' : 'finish'), [
			'tools',
			'finish'
		])
		.addEdge('tools', 'agent')
		.addEdge('finish', END)
		.compile();
}

/** One turn, start to finish, as the route runs it. */
export async function runAssistantTurn<Input, Outcome, P extends Prepared>(
	deps: AssistantTurnDeps<Input, Outcome, P>,
	input: Input
): Promise<Outcome> {
	const graph = buildAssistantTurnGraph(deps);
	const final = await graph.invoke({ input }, { recursionLimit: RECURSION_LIMIT });
	return final.outcome as Outcome;
}
