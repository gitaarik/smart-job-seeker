/**
 * Tests for the ai_chats retention prune.
 *
 * The batching is the part worth pinning: this runs unattended in the worker,
 * and a first pass against a large backlog must not rewrite the whole table in
 * one statement. `moreRemaining` is what tells the caller to come back.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLimit = vi.fn();
const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

const mockWhereUpdate = vi.fn();
const mockSet = vi.fn().mockReturnValue({ where: mockWhereUpdate });
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		select: (...a: any[]) => mockSelect(...a),
		update: (...a: any[]) => mockUpdate(...a)
	}
}));

vi.mock('drizzle-orm', () => ({
	and: vi.fn((...a: any[]) => a),
	or: vi.fn((...a: any[]) => a),
	lt: vi.fn((c: any, v: any) => ({ c, v })),
	isNotNull: vi.fn((c: any) => c),
	inArray: vi.fn((_c: any, v: any) => v)
}));

vi.mock('$lib/server/db/schema', () => ({
	ai_chats: {
		id: 'ai_chats.id',
		date_created: 'ai_chats.date_created',
		full_prompt: 'ai_chats.full_prompt',
		context: 'ai_chats.context'
	}
}));

import { DEFAULT_BATCH_LIMIT, pruneAiChatPayloads } from '../retention';

describe('pruneAiChatPayloads', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSelect.mockReturnValue({ from: mockFrom });
		mockFrom.mockReturnValue({ where: mockWhereSelect });
		mockWhereSelect.mockReturnValue({ limit: mockLimit });
		mockUpdate.mockReturnValue({ set: mockSet });
		mockSet.mockReturnValue({ where: mockWhereUpdate });
		mockWhereUpdate.mockResolvedValue({ rowCount: 0 });
	});

	it('is a no-op when nothing is past the window', async () => {
		mockLimit.mockResolvedValueOnce([]);

		const r = await pruneAiChatPayloads({ days: 30 });

		expect(r).toEqual({ rowsPruned: 0, moreRemaining: false });
		// No UPDATE at all — a repeat pass on a drained table stays cheap.
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it('nulls both heavy columns for the selected rows', async () => {
		mockLimit.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);
		mockWhereUpdate.mockResolvedValueOnce({ rowCount: 3 });

		const r = await pruneAiChatPayloads({ days: 30 });

		expect(mockSet).toHaveBeenCalledWith({ full_prompt: null, context: null });
		// inArray is mocked to return its values, so the where arg is the id list.
		expect(mockWhereUpdate).toHaveBeenCalledWith([1, 2, 3]);
		expect(r.rowsPruned).toBe(3);
	});

	it('reports more remaining when the batch limit is hit', async () => {
		const full = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));
		mockLimit.mockResolvedValueOnce(full);
		mockWhereUpdate.mockResolvedValueOnce({ rowCount: 10 });

		const r = await pruneAiChatPayloads({ days: 30, limit: 10 });

		expect(r).toEqual({ rowsPruned: 10, moreRemaining: true });
	});

	it('does not report more remaining on a partial batch', async () => {
		mockLimit.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
		mockWhereUpdate.mockResolvedValueOnce({ rowCount: 2 });

		const r = await pruneAiChatPayloads({ days: 30, limit: 10 });

		expect(r.moreRemaining).toBe(false);
	});

	it('caps the batch at the default limit when none is given', async () => {
		mockLimit.mockResolvedValueOnce([]);

		await pruneAiChatPayloads({ days: 30 });

		expect(mockLimit).toHaveBeenCalledWith(DEFAULT_BATCH_LIMIT);
	});

	it('falls back to the id count when the driver reports no rowCount', async () => {
		mockLimit.mockResolvedValueOnce([{ id: 7 }, { id: 8 }]);
		mockWhereUpdate.mockResolvedValueOnce({});

		const r = await pruneAiChatPayloads({ days: 30 });

		expect(r.rowsPruned).toBe(2);
	});
});
