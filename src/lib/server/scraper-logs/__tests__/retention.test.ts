/**
 * Tests for the scraper telemetry prune.
 *
 * Two things are worth pinning because this runs unattended in the worker: the
 * batching (a first pass against a large backlog must not issue one enormous
 * DELETE, and `moreRemaining` is what tells the caller to come back), and the
 * screenshot sweep's age check — a directory a live run is still writing to
 * must never be collected.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLimit = vi.fn();
const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

const mockWhereDelete = vi.fn();
const mockDelete = vi.fn().mockReturnValue({ where: mockWhereDelete });

const mockReaddir = vi.fn();
const mockStat = vi.fn();
const mockRm = vi.fn();

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		select: (...a: any[]) => mockSelect(...a),
		delete: (...a: any[]) => mockDelete(...a)
	}
}));

vi.mock('drizzle-orm', () => ({
	and: vi.fn((...a: any[]) => a),
	lt: vi.fn((c: any, v: any) => ({ c, v })),
	inArray: vi.fn((_c: any, v: any) => v),
	sql: vi.fn(() => 'NOT EXISTS(...)')
}));

vi.mock('$lib/server/db/schema', () => ({
	scraper_logs: {
		id: 'scraper_logs.id',
		timestamp: 'scraper_logs.timestamp',
		step_id: 'scraper_logs.step_id'
	},
	scraper_log_steps: {
		id: 'scraper_log_steps.id',
		started_at: 'scraper_log_steps.started_at'
	}
}));

vi.mock('node:fs/promises', () => ({
	readdir: (...a: any[]) => mockReaddir(...a),
	stat: (...a: any[]) => mockStat(...a),
	rm: (...a: any[]) => mockRm(...a)
}));

import { DEFAULT_BATCH_LIMIT, pruneScraperLogs, pruneScraperScreenshots } from '../retention';

const DAY = 24 * 60 * 60 * 1000;

describe('pruneScraperLogs', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSelect.mockReturnValue({ from: mockFrom });
		mockFrom.mockReturnValue({ where: mockWhereSelect });
		mockWhereSelect.mockReturnValue({ limit: mockLimit });
		mockDelete.mockReturnValue({ where: mockWhereDelete });
		mockWhereDelete.mockResolvedValue({ rowCount: 0 });
		mockLimit.mockResolvedValue([]);
	});

	it('deletes nothing but still sweeps steps when no logs are past the window', async () => {
		const r = await pruneScraperLogs({ days: 30 });

		expect(r).toEqual({
			logsDeleted: 0,
			stepsDeleted: 0,
			moreRemaining: false
		});
		// One delete only: the steps sweep. No id list means no log delete.
		expect(mockDelete).toHaveBeenCalledTimes(1);
	});

	it('deletes the selected batch of log rows and reports the count', async () => {
		mockLimit.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);
		mockWhereDelete.mockResolvedValueOnce({ rowCount: 3 }).mockResolvedValueOnce({ rowCount: 2 });

		const r = await pruneScraperLogs({ days: 30 });

		expect(r.logsDeleted).toBe(3);
		expect(r.stepsDeleted).toBe(2);
		expect(mockWhereDelete).toHaveBeenNthCalledWith(1, [1, 2, 3]);
	});

	it('reports moreRemaining when the batch limit is hit', async () => {
		mockLimit.mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => ({ id: i })));

		const r = await pruneScraperLogs({ days: 30, limit: 5 });

		expect(r.moreRemaining).toBe(true);
	});

	it('does not report moreRemaining on a partial batch', async () => {
		mockLimit.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

		const r = await pruneScraperLogs({ days: 30, limit: 5 });

		expect(r.moreRemaining).toBe(false);
	});

	it('applies the default batch limit', async () => {
		await pruneScraperLogs({ days: 30 });

		expect(mockLimit).toHaveBeenCalledWith(DEFAULT_BATCH_LIMIT);
	});

	it('falls back to the id count when the driver reports no rowCount', async () => {
		mockLimit.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
		mockWhereDelete.mockResolvedValue({});

		const r = await pruneScraperLogs({ days: 30 });

		expect(r.logsDeleted).toBe(2);
	});
});

describe('pruneScraperScreenshots', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRm.mockResolvedValue(undefined);
	});

	/** Wire up a `<root>/<task>/<run>/<file>` tree with per-file mtimes. */
	function tree(spec: Record<string, Record<string, [number, number][]>>) {
		const files = new Map<string, { mtimeMs: number; size: number }>();
		const dirs = new Map<string, string[]>();
		dirs.set('/shots', Object.keys(spec));
		for (const [task, runs] of Object.entries(spec)) {
			dirs.set(`/shots/${task}`, Object.keys(runs));
			for (const [run, entries] of Object.entries(runs)) {
				dirs.set(
					`/shots/${task}/${run}`,
					entries.map((_, i) => `${i}.png`)
				);
				entries.forEach(([mtimeMs, size], i) => {
					files.set(`/shots/${task}/${run}/${i}.png`, { mtimeMs, size });
				});
			}
		}
		mockReaddir.mockImplementation(async (p: string) => {
			if (!dirs.has(p)) throw new Error('ENOENT');
			// Re-reading a directory after rm must show it emptied, so the task-dir
			// cleanup sees the truth rather than the pre-sweep listing.
			return dirs.get(p)!.filter((child) => !removed.has(`${p}/${child}`));
		});
		mockStat.mockImplementation(async (p: string) => {
			const f = files.get(p);
			if (!f) throw new Error('ENOENT');
			return f;
		});
		const removed = new Set<string>();
		mockRm.mockImplementation(async (p: string) => {
			removed.add(p);
		});
		return removed;
	}

	it('removes run directories whose newest file is past the window', async () => {
		const now = Date.now();
		const removed = tree({
			'12': {
				'100': [
					[now - 60 * DAY, 1000],
					[now - 55 * DAY, 2000]
				]
			}
		});

		const r = await pruneScraperScreenshots({ days: 30, root: '/shots' });

		expect(r).toEqual({ dirsRemoved: 1, filesRemoved: 2, bytesFreed: 3000 });
		expect(removed.has('/shots/12/100')).toBe(true);
		// Task directory goes too once its last run is gone.
		expect(removed.has('/shots/12')).toBe(true);
	});

	it('keeps a directory a live run is still writing to', async () => {
		const now = Date.now();
		// Old files, but one fresh write — this is an in-flight run.
		tree({
			'12': {
				'100': [
					[now - 60 * DAY, 1000],
					[now - 60 * 1000, 500]
				]
			}
		});

		const r = await pruneScraperScreenshots({ days: 30, root: '/shots' });

		expect(r.dirsRemoved).toBe(0);
		expect(mockRm).not.toHaveBeenCalled();
	});

	it('keeps the task directory while any run is still in the window', async () => {
		const now = Date.now();
		const removed = tree({
			'12': {
				'100': [[now - 60 * DAY, 1000]],
				'101': [[now - 2 * DAY, 1000]]
			}
		});

		const r = await pruneScraperScreenshots({ days: 30, root: '/shots' });

		expect(r.dirsRemoved).toBe(1);
		expect(removed.has('/shots/12/100')).toBe(true);
		expect(removed.has('/shots/12')).toBe(false);
	});

	it('collects an empty leftover run directory', async () => {
		const removed = tree({ '12': { '100': [] } });

		const r = await pruneScraperScreenshots({ days: 30, root: '/shots' });

		expect(r).toEqual({ dirsRemoved: 1, filesRemoved: 0, bytesFreed: 0 });
		expect(removed.has('/shots/12/100')).toBe(true);
	});

	it('treats a missing root as nothing to sweep', async () => {
		mockReaddir.mockRejectedValue(new Error('ENOENT'));

		const r = await pruneScraperScreenshots({ days: 30, root: '/nope' });

		expect(r).toEqual({ dirsRemoved: 0, filesRemoved: 0, bytesFreed: 0 });
		expect(mockRm).not.toHaveBeenCalled();
	});
});
