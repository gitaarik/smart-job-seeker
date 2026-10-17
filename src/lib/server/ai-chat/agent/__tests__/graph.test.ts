/**
 * The assistant's turn as a loop (planning/ASSISTANT-AGENT.md § The turn is
 * the graph): a scripted model instead of a provider, a fake executor instead
 * of the registry, and a finish that keeps what it was handed. What is tested
 * is the routing and the caps: a reply ends the turn, a call runs and its
 * result goes back, text beside a call is discarded, a cap is told to the
 * model and the next call has to be the reply, and a turn that fails stores
 * nothing.
 */
import { describe, expect, it } from 'vitest';
import type { ChatMessage, CompletionResult, ToolCall } from '$lib/server/llm';
import type { ExecutedCall } from '../executor';
import {
	type AssistantTurnDeps,
	buildAssistantTurnGraph,
	capNote,
	claimsProposal,
	claimsRead,
	type Finished,
	MAX_READ_CHARS,
	MAX_ROUNDS,
	MAX_TOOL_CALLS,
	type ModelCall,
	type Prepared,
	runAssistantTurn,
	streamAssistantTurn,
	UNPROPOSED_NOTE,
	UNREAD_NOTE
} from '../graph';
import type { TurnEvent } from '../events';
import { PROPOSAL_RECEIPT, type TurnExecutor } from '../executor';
import type { StoredProposal } from '../proposals';

const call = (name: string, args: Record<string, unknown> = {}, id = `${name}-${Math.random()}`) =>
	({ id, name, args }) as ToolCall;

/** A model answer: a reply, or calls with text beside them. */
const says = (content: string, toolCalls?: ToolCall[]): CompletionResult => ({
	content,
	usage: null,
	...(toolCalls ? { toolCalls, providerData: { signed: true } } : {})
});

const proposal: StoredProposal = {
	capability: 'edit_job_details',
	rationale: 'r',
	fields: { salary_min: 6 },
	previous: { salary_min: 5 },
	target: { id: 100, label: 'Data Engineer' }
};

interface World {
	calls: ModelCall[];
	executed: ToolCall[];
	finished: Finished | null;
	rows: number;
}

/**
 * Deps with a scripted model: one answer per round, in order. The executor
 * answers a read with a text of the size its argument says and a write with
 * the receipt and the proposal; `execute` can be told to fail instead.
 */
function fakeDeps(
	script: CompletionResult[],
	options: { readChars?: number; failExecute?: boolean } = {}
) {
	const world: World = { calls: [], executed: [], finished: null, rows: 0 };
	const deps: AssistantTurnDeps<{ message: string }, Finished> = {
		async prepare(input) {
			const prepared: Prepared = {
				system: 'SYSTEM',
				history: [
					{ role: 'user', content: 'earlier' },
					{ role: 'assistant', content: 'yes' }
				],
				user: input.message,
				tools: [{ name: 'read_job', description: 'd', parameters: { type: 'object' } }],
				async execute(c): Promise<ExecutedCall> {
					world.executed.push(c);
					if (options.failExecute) throw new Error('the database went away');
					const isRead = c.name.startsWith('read_') || c.name.startsWith('list_');
					const chars = Number(c.args.chars ?? options.readChars ?? 100);
					return {
						call: c,
						kind: isRead ? 'read' : 'propose',
						content: isRead
							? 'x'.repeat(chars) +
								(c.args.more ? '\n\n[Call again with offset 6000 for the rest.]' : '')
							: PROPOSAL_RECEIPT,
						isError: !!c.args.refuse,
						...(isRead
							? {}
							: { proposal: { ...proposal, rationale: String(c.args.rationale ?? 'r') } }),
						chars: isRead ? chars : 0,
						cut: false,
						ms: 1,
						fromMemo: !!c.args.memo
					};
				}
			};
			return prepared;
		},
		async callModel(_prepared, modelCall) {
			world.calls.push(modelCall);
			const answer = script[modelCall.round - 1];
			if (!answer) throw new Error(`no scripted answer for round ${modelCall.round}`);
			world.rows += 1;
			return { result: answer, aiChatId: 1000 + world.rows };
		},
		async finish(_input, _prepared, finished) {
			world.finished = finished;
			return finished;
		}
	};
	return { deps, world };
}

const run = (script: CompletionResult[], options?: Parameters<typeof fakeDeps>[1]) => {
	const { deps, world } = fakeDeps(script, options);
	return runAssistantTurn(deps, { message: 'hello' }).then((outcome) => ({ outcome, world }));
};

const roles = (messages: ChatMessage[]) => messages.map((m) => m.role);

describe('the turn', () => {
	it('is one call when the model replies at once, and the reply is the text', async () => {
		const { outcome, world } = await run([says('Just an answer.')]);

		expect(world.calls).toHaveLength(1);
		expect(world.calls[0]).toMatchObject({ round: 1, toolChoice: 'auto', firstAiChatId: null });
		// System, the thread, the message.
		expect(roles(world.calls[0].messages)).toEqual(['system', 'user', 'assistant', 'user']);
		expect(world.calls[0].messages[0]).toEqual({ role: 'system', content: 'SYSTEM' });
		expect(world.calls[0].messages[3]).toEqual({ role: 'user', content: 'hello' });
		expect(outcome).toMatchObject({
			reply: 'Just an answer.',
			reads: [],
			proposed: [],
			aiChatIds: [1001],
			rounds: 1,
			capped: null
		});
	});

	it('runs a read, hands its result back as a tool message, and discards text beside the call', async () => {
		const read = call('read_job', { job_id: 7, more: true }, 'c1');
		const { outcome, world } = await run([says('Let me look.', [read]), says('It pays 6.')]);

		expect(world.executed).toEqual([read]);
		expect(world.calls).toHaveLength(2);
		const second = world.calls[1];
		expect(second).toMatchObject({ round: 2, toolChoice: 'auto', firstAiChatId: 1001 });
		// The call replayed without its text, with the provider's data; then the answer.
		expect(second.messages.slice(-2)).toEqual([
			{ role: 'assistant', content: '', toolCalls: [read], providerData: { signed: true } },
			{
				role: 'tool',
				toolCallId: 'c1',
				name: 'read_job',
				content: 'x'.repeat(100) + '\n\n[Call again with offset 6000 for the rest.]',
				isError: false
			}
		]);
		expect(outcome.reply).toBe('It pays 6.');
		expect(outcome.reads).toEqual([
			{
				tool: 'read_job',
				args: { job_id: 7, more: true },
				chars: 100,
				offsetEnd: 6000,
				ms: 1,
				round: 1,
				ok: true
			}
		]);
		expect(outcome.aiChatIds).toEqual([1001, 1002]);
		expect(outcome.rounds).toBe(2);
	});

	it('keeps a write as a proposal with the row of the call that made it, and the model gets the receipt', async () => {
		const write = call(
			'edit_job_details',
			{ job_id: 100, salary_min: 6, rationale: 'You asked.' },
			'w1'
		);
		const { outcome, world } = await run([says('', [write]), says('Proposed.')]);

		expect(world.calls[1].messages.at(-1)).toMatchObject({
			role: 'tool',
			toolCallId: 'w1',
			content: PROPOSAL_RECEIPT,
			isError: false
		});
		expect(outcome.proposed).toEqual([
			{ proposal: { ...proposal, rationale: 'You asked.' }, aiChatId: 1001 }
		]);
		expect(outcome.reads).toEqual([]);
	});

	it('runs the calls of one round together and keeps their order', async () => {
		const a = call('read_job', { job_id: 1 }, 'a');
		const b = call('edit_job_details', { job_id: 100, rationale: 'r' }, 'b');
		const c = call('list_jobs', {}, 'c');
		const { world } = await run([says('', [a, b, c]), says('done')]);

		expect(world.executed.map((x) => x.id)).toEqual(['a', 'b', 'c']);
		expect(
			world.calls[1].messages.slice(-3).map((m) => (m.role === 'tool' ? m.toolCallId : m.role))
		).toEqual(['a', 'b', 'c']);
	});

	describe('a reply that claims a proposal the turn does not hold', () => {
		const claim =
			"Of course. I've proposed an update to the job details to reflect that. " +
			"You'll see the change proposed below for you to approve.";

		it('goes back to the model once, with the note, and the call it then makes counts', async () => {
			const write = call('edit_job_details', { salary_min: 6 }, 'w1');
			const { outcome, world } = await run([
				says(claim),
				says('', [write]),
				says('Proposed, and waiting for you.')
			]);

			expect(world.calls).toHaveLength(3);
			const second = world.calls[1].messages;
			expect(roles(second).slice(-3)).toEqual(['user', 'assistant', 'user']);
			expect(second[second.length - 2]).toEqual({ role: 'assistant', content: claim });
			expect(second[second.length - 1]).toEqual({ role: 'user', content: UNPROPOSED_NOTE });
			expect(world.calls[1].toolChoice).toBe('auto');
			expect(outcome.proposed).toHaveLength(1);
			expect(outcome.reply).toBe('Proposed, and waiting for you.');
			expect(outcome.rounds).toBe(3);
		});

		it('takes the second reply as it is, so a turn cannot loop on the note', async () => {
			const { outcome, world } = await run([says(claim), says(claim)]);
			expect(world.calls).toHaveLength(2);
			expect(outcome.reply).toBe(claim);
			expect(outcome.rounds).toBe(2);
		});

		it('leaves a reply alone when the turn holds the proposal it talks about', async () => {
			const write = call('edit_job_details', { salary_min: 6 }, 'w1');
			const { outcome, world } = await run([says('', [write]), says(claim)]);
			expect(world.calls).toHaveLength(2);
			expect(outcome.reply).toBe(claim);
		});

		it('leaves a forced last round alone, which could not have called anyway', async () => {
			const read = (id: string) => call('read_job', { job_id: 1 }, id);
			const { outcome, world } = await run([
				says('', [read('a')]),
				says('', [read('b')]),
				says('', [read('c')]),
				says(claim)
			]);
			expect(world.calls).toHaveLength(MAX_ROUNDS);
			expect(outcome.reply).toBe(claim);
		});

		it('knows the claim when it sees one', () => {
			expect(claimsProposal(claim)).toBe(true);
			expect(claimsProposal("I've updated the salary to 120k for you.")).toBe(true);
			expect(claimsProposal('The change is ready for you to review below.')).toBe(true);
			expect(claimsProposal('Both changes are waiting for your approval.')).toBe(true);
			expect(claimsProposal('The salary on the posting is 120k; is that what you meant?')).toBe(
				false
			);
			expect(
				claimsProposal('Three things you could tighten: the summary, the dates, the title.')
			).toBe(false);
			expect(
				claimsProposal('Did you have a conversation with him that we have not recorded?')
			).toBe(false);
		});
	});

	describe('a reply that claims a read the turn never made', () => {
		const invented =
			"I've just reviewed the transcripts from your application with SOUS. " +
			'He explained that SOUS is currently bootstrapped and profitable.';
		const denial =
			"I've looked through all the notes and messages on file for that one, and I " +
			"can't see any mention of funding.";

		it('goes back to the model once, with the note, and the read it then makes counts', async () => {
			const read = call('read_activity_entry', { entry_id: 45 }, 'r1');
			const { outcome, world } = await run([
				says(invented),
				says('', [read]),
				says('He said: a seed round, two years of runway.')
			]);

			expect(world.calls).toHaveLength(3);
			const second = world.calls[1].messages;
			expect(second[second.length - 2]).toEqual({ role: 'assistant', content: invented });
			expect(second[second.length - 1]).toEqual({ role: 'user', content: UNREAD_NOTE });
			expect(outcome.reads).toHaveLength(1);
			expect(outcome.reply).toBe('He said: a seed round, two years of runway.');
		});

		it('sends the "can\'t see" reply back the same way', async () => {
			const { outcome, world } = await run([says(denial), says('I have not read that call yet.')]);
			expect(world.calls).toHaveLength(2);
			expect(world.calls[1].messages[world.calls[1].messages.length - 1]).toEqual({
				role: 'user',
				content: UNREAD_NOTE
			});
			expect(outcome.reply).toBe('I have not read that call yet.');
		});

		it('leaves a reply alone when the turn did read', async () => {
			const read = call('read_activity_entry', { entry_id: 12 }, 'r1');
			const { outcome, world } = await run([says('', [read]), says(denial)]);
			expect(world.calls).toHaveLength(2);
			expect(outcome.reply).toBe(denial);
		});

		it('knows the claim when it sees one', () => {
			expect(claimsRead(invented)).toBe(true);
			expect(claimsRead(denial)).toBe(true);
			expect(claimsRead("I can't find anyone named William in your profile.")).toBe(true);
			expect(claimsRead('There is no record of a call with him.')).toBe(true);
			expect(claimsRead('Your summary could lead with the migration you ran at Chipta.')).toBe(
				false
			);
			expect(claimsRead('Did you have a conversation with him that we have not recorded?')).toBe(
				false
			);
			expect(claimsRead('The posting asks for Kafka, which your profile does not list.')).toBe(
				false
			);
		});
	});

	it('hands a refusal back marked as one, and goes on', async () => {
		const bad = call('read_job', { job_id: 999, refuse: true }, 'r1');
		const { outcome, world } = await run([says('', [bad]), says('No such job.')]);

		expect(world.calls[1].messages.at(-1)).toMatchObject({ role: 'tool', isError: true });
		expect(outcome.reads[0]).toMatchObject({ ok: false });
	});

	describe('the caps', () => {
		it('holds the model to the last round: told so in the last result, it cannot call again', async () => {
			const always = (round: number) =>
				says('', [call('read_job', { job_id: round }, `r${round}`)]);
			const script = [always(1), always(2), always(3), says('From what I have.')];
			const { outcome, world } = await run(script);

			expect(world.calls.map((c) => c.toolChoice)).toEqual(['auto', 'auto', 'auto', 'none']);
			expect(world.calls).toHaveLength(MAX_ROUNDS);
			const lastToolMessage = world.calls[3].messages.at(-1);
			expect(lastToolMessage).toMatchObject({ role: 'tool', toolCallId: 'r3' });
			expect((lastToolMessage as { content: string }).content).toContain(capNote('the last round'));
			// Rounds before the last carry no note.
			expect((world.calls[2].messages.at(-1) as { content: string }).content).not.toContain(
				'[This turn'
			);
			expect(outcome).toMatchObject({
				reply: 'From what I have.',
				capped: 'the last round',
				rounds: 4
			});
		});

		it('takes the reply of a forced round even when the model still sent calls', async () => {
			const always = (round: number) =>
				says('An answer anyway.', [call('read_job', { job_id: round })]);
			const { outcome, world } = await run([always(1), always(2), always(3), always(4)]);

			expect(world.calls).toHaveLength(MAX_ROUNDS);
			expect(outcome.reply).toBe('An answer anyway.');
			// The calls of the forced round were not run.
			expect(world.executed).toHaveLength(3);
		});

		it('stops at the tool-call cap', async () => {
			const many = Array.from({ length: MAX_TOOL_CALLS }, (_, i) =>
				call('read_job', { job_id: i }, `m${i}`)
			);
			const { outcome, world } = await run([says('', many), says('Enough.')]);

			expect(world.calls[1].toolChoice).toBe('none');
			expect((world.calls[1].messages.at(-1) as { content: string }).content).toContain(
				capNote(`${MAX_TOOL_CALLS} tool calls`)
			);
			expect(outcome.capped).toBe(`${MAX_TOOL_CALLS} tool calls`);
		});

		it('runs no more calls in one round than the turn has room for, and answers the rest', async () => {
			const asked = Array.from({ length: MAX_TOOL_CALLS + 3 }, (_, i) =>
				call('read_job', { job_id: i }, `q${i}`)
			);
			const { outcome, world } = await run([says('', asked), says('Enough.')]);

			expect(world.executed).toHaveLength(MAX_TOOL_CALLS);
			const answers = world.calls[1].messages.slice(-asked.length);
			// Every call the model made is answered, the ones left out with a refusal.
			expect(answers.map((m) => (m.role === 'tool' ? m.toolCallId : m.role))).toEqual(
				asked.map((c) => c.id)
			);
			expect(answers.slice(MAX_TOOL_CALLS).every((m) => m.role === 'tool' && m.isError)).toBe(true);
			expect((answers.at(-1) as { content: string }).content).toContain('Not run');
			expect((answers.at(-1) as { content: string }).content).toContain(
				capNote(`${MAX_TOOL_CALLS} tool calls`)
			);
			expect(outcome.capped).toBe(`${MAX_TOOL_CALLS} tool calls`);
			expect(world.calls[1].toolChoice).toBe('none');
		});

		it('stops at the read budget, counting a memo hit as nothing', async () => {
			const big = call('read_job', { job_id: 1, chars: MAX_READ_CHARS }, 'big');
			const { outcome, world } = await run([says('', [big]), says('Enough.')]);
			expect(world.calls[1].toolChoice).toBe('none');
			expect(outcome.capped).toBe(`${MAX_READ_CHARS.toLocaleString('en-US')} characters read`);

			const memo = call('read_job', { job_id: 1, chars: MAX_READ_CHARS, memo: true }, 'memo');
			const again = await run([says('', [memo]), says('Enough.')]);
			expect(again.outcome.capped).toBeNull();
			expect(again.outcome.reads[0]).toMatchObject({ fromMemo: true });
		});
	});

	describe('a failed turn', () => {
		it('stores nothing when the model fails after a write', async () => {
			const { deps, world } = fakeDeps([says('', [call('edit_job_details', { job_id: 100 })])]);
			await expect(runAssistantTurn(deps, { message: 'x' })).rejects.toThrow(/no scripted answer/);
			expect(world.finished).toBeNull();
		});

		it('stores nothing when a tool fails', async () => {
			const { deps, world } = fakeDeps([says('', [call('read_job', { job_id: 1 })]), says('?')], {
				failExecute: true
			});
			await expect(runAssistantTurn(deps, { message: 'x' })).rejects.toThrow(/database went away/);
			expect(world.finished).toBeNull();
		});

		it('refuses a turn whose reply is empty', async () => {
			const { deps, world } = fakeDeps([says('   ')]);
			await expect(runAssistantTurn(deps, { message: 'x' })).rejects.toThrow(/wrote no reply/);
			expect(world.finished).toBeNull();
		});
	});

	describe('streamed', () => {
		it('tells each node as it starts and each tool call as it starts and ends, then hands back the outcome', async () => {
			const read = call('read_job', { job_id: 7 }, 'c1');
			const { deps } = fakeDeps([says('', [read]), says('It pays 6.')]);
			const events: TurnEvent[] = [];

			const outcome = await streamAssistantTurn(deps, { message: 'hello' }, (e) => events.push(e));

			expect(outcome).toMatchObject({ reply: 'It pays 6.', rounds: 2 });
			expect(events).toEqual([
				{ type: 'step', node: 'prepare' },
				{ type: 'step', node: 'agent' },
				{ type: 'step', node: 'tools' },
				{ type: 'tool', name: 'read_job', label: 'Reading job 7', status: 'started' },
				{ type: 'tool', name: 'read_job', label: 'Reading job 7', status: 'done' },
				{ type: 'step', node: 'agent' },
				{ type: 'step', node: 'finish' }
			]);
		});

		it('marks a refused call as refused', async () => {
			const bad = call('read_job', { job_id: 999, refuse: true }, 'r1');
			const { deps } = fakeDeps([says('', [bad]), says('No such job.')]);
			const events: TurnEvent[] = [];
			await streamAssistantTurn(deps, { message: 'hello' }, (e) => events.push(e));
			expect(
				events.filter((e) => e.type === 'tool').map((e) => (e as { status: string }).status)
			).toEqual(['started', 'refused']);
		});

		it('throws what the turn threw, after the steps it did reach', async () => {
			const { deps, world } = fakeDeps([says('', [call('read_job', { job_id: 1 })])], {
				failExecute: true
			});
			const events: TurnEvent[] = [];
			await expect(
				streamAssistantTurn(deps, { message: 'x' }, (e) => events.push(e))
			).rejects.toThrow(/database went away/);
			expect(events.map((e) => e.type)).toEqual(['step', 'step', 'step', 'tool']);
			expect(world.finished).toBeNull();
		});
	});

	it('compiles to the four nodes and their edges', () => {
		const { deps } = fakeDeps([]);
		const graph = buildAssistantTurnGraph(deps);
		expect(Object.keys(graph.getGraph().nodes).sort()).toEqual(
			['__end__', '__start__', 'agent', 'finish', 'prepare', 'tools'].sort()
		);
	});
});

// A compile-time check that the real deps type fits the graph's: see turn.ts.
export type _TurnExecutorIsUsed = TurnExecutor;
