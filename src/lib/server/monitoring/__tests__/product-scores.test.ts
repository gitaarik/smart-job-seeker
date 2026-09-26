/**
 * Product scores land on the generation behind an ai_chats row, under an id
 * that names what they are about, and never happen without Langfuse.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
	/** What each successive query answers, in order. */
	answers: [] as Record<string, unknown>[][],
	sends: true
};
const mockSelect = vi.fn();
const mockCreate = vi.fn();

vi.mock('$lib/server/db', () => {
	const chain = {
		from: () => chain,
		innerJoin: () => chain,
		where: () => chain,
		limit: () => Promise.resolve(state.answers.shift() ?? [])
	};
	return {
		db: {
			select: (...a: unknown[]) => {
				mockSelect(...a);
				return chain;
			}
		}
	};
});
vi.mock('../langfuse-client', () => ({
	langfuseClient: () => ({ score: { create: (...a: unknown[]) => mockCreate(...a) } })
}));
vi.mock('../telemetry', () => ({ sendsToLangfuse: () => state.sends }));
vi.mock('../sentry', () => ({ getEnvironmentName: () => 'preview' }));

import { scoreGeneration, scoreProposalTurn } from '../product-scores';

beforeEach(() => {
	vi.clearAllMocks();
	state.answers = [];
	state.sends = true;
});

/** Let the fire-and-forget work run. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('product scores', () => {
	it('score the generation behind a row, under an id naming what and where', async () => {
		state.answers = [[{ traceId: 't1', observationId: 'o1' }]];
		scoreGeneration(7, 'proposal_applied', 'proposal:17', true);
		await settled();

		expect(mockCreate).toHaveBeenCalledWith({
			id: 'preview:proposal_applied:proposal:17',
			environment: 'preview',
			traceId: 't1',
			observationId: 'o1',
			name: 'proposal_applied',
			value: 1,
			dataType: 'BOOLEAN'
		});
	});

	it('find the assistant turn behind a proposal', async () => {
		state.answers = [[{ aiChatId: 7 }], [{ traceId: 't2', observationId: null }]];
		scoreProposalTurn(31, 'edit_undone', 'edit:9', true);
		await settled();

		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'preview:edit_undone:edit:9',
				traceId: 't2',
				observationId: undefined,
				value: 1
			})
		);
	});

	it('skip a row whose trace was not recorded', async () => {
		state.answers = [[{ traceId: null, observationId: null }]];
		scoreGeneration(7, 'version_used', 'letter_version:3', false);
		await settled();
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it('do nothing at all without Langfuse, not even a query', async () => {
		state.sends = false;
		scoreGeneration(7, 'proposal_applied', 'proposal:17', true);
		scoreProposalTurn(31, 'edit_undone', 'edit:9', true);
		await settled();
		expect(mockSelect).not.toHaveBeenCalled();
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it('never throw, whatever the database does', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		mockSelect.mockImplementationOnce(() => {
			throw new Error('connection reset');
		});
		expect(() => scoreGeneration(7, 'proposal_applied', 'proposal:17', true)).not.toThrow();
		await settled();
		warn.mockRestore();
	});
});
