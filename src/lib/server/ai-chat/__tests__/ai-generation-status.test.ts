/**
 * Unit tests for ai-generation-status. Focus on the non-trivial logic:
 * isGenerating's fresh/stale/absent branches and trackGeneration's
 * begin→finally-end ordering (cleared even when the body throws). The real SQL
 * (upsert, TTL sweep) is exercised end-to-end separately.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Rows the mocked select returns for the current test.
let selectRows: Array<{ started_at: Date }> = [];
const deleteWhere = vi.fn().mockResolvedValue(undefined);
const insertOnConflict = vi.fn().mockResolvedValue(undefined);

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		select: () => ({
			from: () => ({
				where: () => ({ limit: () => Promise.resolve(selectRows) })
			})
		}),
		insert: () => ({
			values: () => ({
				onConflictDoUpdate: (...a: unknown[]) => insertOnConflict(...a)
			})
		}),
		delete: () => ({ where: (...a: unknown[]) => deleteWhere(...a) })
	}
}));

vi.mock('drizzle-orm', () => ({
	and: (...a: unknown[]) => a,
	eq: (...a: unknown[]) => a,
	lt: (...a: unknown[]) => a
}));

vi.mock('$lib/server/db/schema', () => ({
	ai_generations: {
		entity_type: 'ag.entity_type',
		entity_id: 'ag.entity_id',
		started_at: 'ag.started_at'
	}
}));

import {
	beginGeneration,
	endGeneration,
	isGenerating,
	trackGeneration
} from '../ai-generation-status';

describe('isGenerating', () => {
	beforeEach(() => {
		selectRows = [];
		deleteWhere.mockClear();
		insertOnConflict.mockClear();
	});

	it('is false when no row exists', async () => {
		selectRows = [];
		expect(await isGenerating('story', 1)).toBe(false);
		expect(deleteWhere).not.toHaveBeenCalled();
	});

	it('is true for a fresh row', async () => {
		selectRows = [{ started_at: new Date() }];
		expect(await isGenerating('story', 1)).toBe(true);
		expect(deleteWhere).not.toHaveBeenCalled();
	});

	it('is false for a stale row and sweeps it', async () => {
		selectRows = [{ started_at: new Date(Date.now() - 6 * 60 * 1000) }];
		expect(await isGenerating('story', 1)).toBe(false);
		expect(deleteWhere).toHaveBeenCalledTimes(1);
	});
});

describe('trackGeneration', () => {
	beforeEach(() => {
		deleteWhere.mockClear();
		insertOnConflict.mockClear();
	});

	it('begins then ends around the body', async () => {
		const order: string[] = [];
		insertOnConflict.mockImplementationOnce(() => {
			order.push('begin');
			return Promise.resolve();
		});
		deleteWhere.mockImplementationOnce(() => {
			order.push('end');
			return Promise.resolve();
		});
		const out = await trackGeneration('letter', 2, 'generate', async () => {
			order.push('body');
			return 'done';
		});
		expect(out).toBe('done');
		expect(order).toEqual(['begin', 'body', 'end']);
	});

	it('clears the flag even when the body throws', async () => {
		await expect(
			trackGeneration('question', 3, null, async () => {
				throw new Error('boom');
			})
		).rejects.toThrow('boom');
		expect(deleteWhere).toHaveBeenCalledTimes(1); // endGeneration ran in finally
	});
});

describe('begin/end', () => {
	beforeEach(() => {
		deleteWhere.mockClear();
		insertOnConflict.mockClear();
	});

	it('beginGeneration upserts', async () => {
		await beginGeneration('story', 4, 'advice');
		expect(insertOnConflict).toHaveBeenCalledTimes(1);
	});

	it('endGeneration deletes', async () => {
		await endGeneration('story', 4);
		expect(deleteWhere).toHaveBeenCalledTimes(1);
	});
});
