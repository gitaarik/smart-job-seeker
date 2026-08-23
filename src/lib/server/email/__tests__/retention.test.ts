/**
 * Tests for the stored-email prune.
 *
 * This runs unattended in the worker and deletes rather than tombstones, so the
 * properties worth pinning are the ones that decide *what* goes: the cutoff is
 * measured from the right column on each table (they disagree — `received_at`
 * against `sent_at`, and reading the wrong one would silently delete nothing),
 * the batching bounds a first pass against a backlog, and `moreRemaining` is
 * what tells the worker to come back.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLimit = vi.fn();
const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

const mockWhereDelete = vi.fn();
const mockDelete = vi.fn().mockReturnValue({ where: mockWhereDelete });

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		select: (...a: unknown[]) => mockSelect(...a),
		delete: (...a: unknown[]) => mockDelete(...a)
	}
}));

vi.mock('drizzle-orm', () => ({
	lt: vi.fn((c: unknown, v: unknown) => ({ col: c, cutoff: v })),
	inArray: vi.fn((c: unknown, v: unknown) => ({ col: c, ids: v }))
}));

vi.mock('$lib/server/db/schema', () => ({
	inbound_emails: { id: 'inbound_emails.id', received_at: 'inbound_emails.received_at' },
	sent_emails: { id: 'sent_emails.id', sent_at: 'sent_emails.sent_at' }
}));

import { DEFAULT_BATCH_LIMIT, pruneInboundEmails, pruneSentEmails } from '../retention';

const DAY = 24 * 60 * 60 * 1000;

/** Both functions are the same shape against a different table. */
const TABLES = [
	{
		name: 'inbound_emails',
		prune: pruneInboundEmails,
		table: 'inbound_emails',
		ageColumn: 'inbound_emails.received_at'
	},
	{
		name: 'sent_emails',
		prune: pruneSentEmails,
		table: 'sent_emails',
		ageColumn: 'sent_emails.sent_at'
	}
] as const;

describe.each(TABLES)('prune $name', ({ prune, table, ageColumn }) => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSelect.mockReturnValue({ from: mockFrom });
		mockFrom.mockReturnValue({ where: mockWhereSelect });
		mockWhereSelect.mockReturnValue({ limit: mockLimit });
		mockDelete.mockReturnValue({ where: mockWhereDelete });
		mockWhereDelete.mockResolvedValue({ rowCount: 0 });
		mockLimit.mockResolvedValue([]);
	});

	it('issues no delete when nothing is past the window', async () => {
		const r = await prune({ days: 30 });

		expect(r).toEqual({ rowsDeleted: 0, moreRemaining: false });
		expect(mockDelete).not.toHaveBeenCalled();
	});

	it('deletes the selected batch and reports the count', async () => {
		mockLimit.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);
		mockWhereDelete.mockResolvedValueOnce({ rowCount: 3 });

		const r = await prune({ days: 30 });

		expect(r.rowsDeleted).toBe(3);
		expect(mockDelete).toHaveBeenCalledWith(expect.objectContaining({ id: `${table}.id` }));
		expect(mockWhereDelete).toHaveBeenCalledWith({ col: `${table}.id`, ids: [1, 2, 3] });
	});

	it("measures the window from the table's own age column", async () => {
		const before = Date.now();

		await prune({ days: 30 });

		const arg = mockWhereSelect.mock.calls[0][0];
		expect(arg.col).toBe(ageColumn);
		// 30 days back, give or take the time the call itself took.
		expect(arg.cutoff.getTime()).toBeGreaterThanOrEqual(before - 30 * DAY - 1000);
		expect(arg.cutoff.getTime()).toBeLessThanOrEqual(Date.now() - 30 * DAY);
	});

	it('reports moreRemaining when the batch limit is hit', async () => {
		mockLimit.mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => ({ id: i })));

		const r = await prune({ days: 30, limit: 5 });

		expect(r.moreRemaining).toBe(true);
	});

	it('does not report moreRemaining on a partial batch', async () => {
		mockLimit.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

		const r = await prune({ days: 30, limit: 5 });

		expect(r.moreRemaining).toBe(false);
	});

	it('applies the default batch limit', async () => {
		await prune({ days: 30 });

		expect(mockLimit).toHaveBeenCalledWith(DEFAULT_BATCH_LIMIT);
	});

	it('falls back to the id count when the driver reports no rowCount', async () => {
		mockLimit.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
		mockWhereDelete.mockResolvedValueOnce({});

		const r = await prune({ days: 30 });

		expect(r.rowsDeleted).toBe(2);
	});
});
