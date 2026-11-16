import { describe, expect, it, vi } from 'vitest';
import {
	REMIND_MS,
	Watchdog,
	evaluateSignals,
	type FiringAlert,
	type Signals,
	type Thresholds
} from '../watchdog';

const t: Thresholds = {
	queueWaiting: 50,
	queueAgeMin: 45,
	stuckRunMin: 90,
	failureWindowMin: 180,
	failureMinCount: 3,
	failureRate: 0.5,
	llmSpendFraction: 0.8
};

function quiet(): Signals {
	return {
		queues: [{ name: 'feed-import', waiting: 0, oldestWaitingMin: null }],
		stuckRuns: { count: 0, oldestMin: null },
		scheduledRuns: { finished: 10, ourFailures: 0, byKind: {} },
		llm: { spentUsd: 1, limitUsd: 25 }
	};
}

const keys = (s: Signals) => evaluateSignals(s, t).map((a) => a.key);

describe('evaluateSignals', () => {
	it('fires nothing on a quiet system', () => {
		expect(keys(quiet())).toEqual([]);
	});

	it('fires on queue depth and on queue age separately', () => {
		const s = quiet();
		s.queues = [
			{ name: 'feed-import', waiting: 50, oldestWaitingMin: 2 },
			{ name: 'ats-board', waiting: 1, oldestWaitingMin: 46 }
		];
		expect(keys(s)).toEqual(['queue-depth:feed-import', 'queue-age:ats-board']);
	});

	it('fires on a stuck run', () => {
		const s = quiet();
		s.stuckRuns = { count: 1, oldestMin: 140 };
		expect(keys(s)).toEqual(['stuck-runs']);
	});

	it('needs both the count and the rate before calling failures ours', () => {
		const s = quiet();
		s.scheduledRuns = { finished: 4, ourFailures: 2, byKind: { infrastructure: 2 } };
		expect(keys(s)).toEqual([]); // 50%, but only two

		s.scheduledRuns = { finished: 20, ourFailures: 3, byKind: { infrastructure: 3 } };
		expect(keys(s)).toEqual([]); // three, but 15%

		s.scheduledRuns = { finished: 5, ourFailures: 3, byKind: { infrastructure: 3 } };
		expect(keys(s)).toEqual(['scheduled-run-failures']);
	});

	it('warns near the LLM limit and says so once it is reached', () => {
		const s = quiet();
		s.llm = { spentUsd: 20, limitUsd: 25 };
		expect(keys(s)).toEqual(['llm-spend-high']);
		s.llm = { spentUsd: 25, limitUsd: 25 };
		expect(keys(s)).toEqual(['llm-spend-limit']);
	});

	it('stays quiet about spend when the limit is off', () => {
		const s = quiet();
		s.llm = { spentUsd: 500, limitUsd: 0 };
		expect(keys(s)).toEqual([]);
	});
});

describe('Watchdog', () => {
	const alert = (key: string): FiringAlert => ({ key, summary: `${key} summary`, detail: 'd' });

	it('announces once, reminds after REMIND_MS, and reports the clear', async () => {
		const notify = vi.fn().mockResolvedValue(undefined);
		const dog = new Watchdog(notify);

		await dog.apply([alert('stuck-runs')], 0);
		await dog.apply([alert('stuck-runs')], 5 * 60_000);
		expect(notify).toHaveBeenCalledTimes(1);
		expect(notify.mock.calls[0][0].subject).toBe('stuck-runs summary');

		await dog.apply([alert('stuck-runs')], REMIND_MS);
		expect(notify).toHaveBeenCalledTimes(2);
		expect(notify.mock.calls[1][0].subject).toBe('Still: stuck-runs summary');

		await dog.apply([], REMIND_MS + 1);
		expect(notify).toHaveBeenCalledTimes(3);
		expect(notify.mock.calls[2][0].subject).toBe('Cleared: stuck-runs summary');
		expect(dog.firing()).toEqual([]);
	});

	it('tracks each key on its own', async () => {
		const notify = vi.fn().mockResolvedValue(undefined);
		const dog = new Watchdog(notify);

		await dog.apply([alert('a')], 0);
		await dog.apply([alert('a'), alert('b')], 1);
		await dog.apply([alert('b')], 2);

		expect(notify.mock.calls.map((c) => c[0].subject)).toEqual([
			'a summary',
			'b summary',
			'Cleared: a summary'
		]);
		expect(dog.firing()).toEqual(['b']);
	});
});
