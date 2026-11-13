/**
 * The daily spend ceiling: the tally, the refusal, the two alerts, and what a
 * Redis that cannot answer does to them.
 *
 * Redis is an in-memory fake behind the real `failOpen` signature; the pricing
 * is the real table.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { store, redisDown, mockConfig, mockError, mockWarn } = vi.hoisted(() => ({
	store: new Map<string, number>(),
	redisDown: { value: false },
	mockConfig: { llmDailyLimitUsd: 1 },
	mockError: vi.fn(),
	mockWarn: vi.fn()
}));

vi.mock('$lib/server/config', () => ({ config: mockConfig }));

vi.mock('$lib/server/monitoring/error-tracker', () => ({
	errorTracker: { logError: mockError, logWarning: mockWarn }
}));

vi.mock('../../queue/redis-fail-open.js', () => {
	const client = {
		get: async (key: string) => (store.has(key) ? String(store.get(key)) : null),
		multi() {
			const ops: Array<() => [null, number]> = [];
			const chain = {
				incrby(key: string, by: number) {
					ops.push(() => {
						store.set(key, (store.get(key) ?? 0) + by);
						return [null, store.get(key)!];
					});
					return chain;
				},
				expire() {
					ops.push(() => [null, 1]);
					return chain;
				},
				exec: async () => ops.map((op) => op())
			};
			return chain;
		}
	};
	return {
		failOpen: async (_what: string, _fallback: string, run: (c: typeof client) => unknown) =>
			redisDown.value ? null : run(client)
	};
});

import {
	assertUnderDailyLimit,
	DailySpendLimitReached,
	recordSpend,
	spentTodayUsd
} from '../spend-limit';
import { isFatalLLMError } from '../index';
import { isFallbackEligible } from '../langchain';

/** gpt-oss-120b: 1M input tokens is $0.15, 1M output $0.60. */
const groq = (inputTokens: number, outputTokens = 0) =>
	recordSpend('groq', 'openai/gpt-oss-120b', { inputTokens, outputTokens });

beforeEach(() => {
	store.clear();
	redisDown.value = false;
	mockConfig.llmDailyLimitUsd = 1;
	mockError.mockClear();
	mockWarn.mockClear();
});

describe('the tally', () => {
	it('adds each answered call at the provider price', async () => {
		await groq(1_000_000);
		await groq(0, 1_000_000);
		expect(await spentTodayUsd()).toBeCloseTo(0.75, 6);
	});

	it('prices cached input at the cached rate', async () => {
		await recordSpend('groq', 'openai/gpt-oss-120b', {
			inputTokens: 1_000_000,
			outputTokens: 0,
			cachedInputTokens: 1_000_000
		});
		expect(await spentTodayUsd()).toBeCloseTo(0.075, 6);
	});

	it('adds nothing for a model with no price', async () => {
		await recordSpend('nobody', 'unpriced', { inputTokens: 1_000_000, outputTokens: 0 });
		expect(store.size).toBe(0);
	});

	it('keeps one key per UTC day', async () => {
		await groq(1000);
		expect([...store.keys()]).toEqual([`llm:spend:${new Date().toISOString().slice(0, 10)}`]);
	});
});

describe('the refusal', () => {
	it('lets calls through under the limit', async () => {
		await groq(6_000_000); // $0.90
		await expect(assertUnderDailyLimit()).resolves.toBeUndefined();
	});

	it('refuses once the limit is reached', async () => {
		await groq(7_000_000); // $1.05
		await expect(assertUnderDailyLimit()).rejects.toBeInstanceOf(DailySpendLimitReached);
	});

	it('reads as fatal to the matcher and is never handed to a fallback provider', () => {
		const error = new DailySpendLimitReached(1.05, 1);
		expect(isFatalLLMError(error)).toBe(true);
		expect(isFallbackEligible(error)).toBe(false);
	});

	it('is off at 0, and records nothing', async () => {
		mockConfig.llmDailyLimitUsd = 0;
		await groq(100_000_000);
		expect(store.size).toBe(0);
		await expect(assertUnderDailyLimit()).resolves.toBeUndefined();
	});

	it('fails open when Redis cannot answer', async () => {
		await groq(7_000_000);
		redisDown.value = true;
		await expect(assertUnderDailyLimit()).resolves.toBeUndefined();
		await expect(groq(1000)).resolves.toBeUndefined();
	});
});

describe('the alerts', () => {
	it('warns once on crossing half the limit', async () => {
		await groq(3_000_000); // $0.45
		expect(mockWarn).not.toHaveBeenCalled();
		await groq(1_000_000); // $0.60
		await groq(1_000_000); // $0.75
		expect(mockWarn).toHaveBeenCalledTimes(1);
		expect(mockError).not.toHaveBeenCalled();
	});

	it('logs an error once on crossing the limit', async () => {
		await groq(6_000_000); // $0.90
		await groq(1_000_000); // $1.05
		await groq(1_000_000); // $1.20
		expect(mockError).toHaveBeenCalledTimes(1);
		expect(mockError.mock.calls[0][2]).toMatchObject({
			operation: 'llm-spend-limit',
			metadata: { limitUsd: 1 }
		});
	});

	it('logs only the error when one call crosses both', async () => {
		await groq(10_000_000); // $1.50 in one go
		expect(mockError).toHaveBeenCalledTimes(1);
		expect(mockWarn).not.toHaveBeenCalled();
	});
});
