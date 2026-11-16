/**
 * The Redis-backed limiters: what they send, how they read the answer, and
 * that a Redis which cannot answer falls back to counting in memory rather
 * than to no limit or to a refusal.
 *
 * ioredis is the FakeRedis stand-in here (vitest.setup.ts), which cannot run
 * Lua. Tests that need an answer from Redis stub `eval` on it; the scripts
 * themselves are checked against a real Redis by hand (see the commit that
 * added this file), since oss CI has no Redis service.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRedisClient } from '../../queue/redis';
import { aiRateLimiter } from '../rate-limit';
import {
	RATE_LIMIT_KEY_PREFIX,
	redisAuthRateLimitStorage,
	resetMemoryWindows
} from '../redis-rate-limit';

const client = getRedisClient() as unknown as {
	status: string;
	eval?: (...args: unknown[]) => Promise<unknown>;
};

beforeEach(() => {
	client.status = 'ready';
	aiRateLimiter.reset();
	resetMemoryWindows();
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	delete client.eval;
	vi.restoreAllMocks();
});

describe('RateLimiter.consumeKey', () => {
	it('asks Redis under the limiter name and takes its answer', async () => {
		const evalFn = vi.fn().mockResolvedValue(0);
		client.eval = evalFn;

		expect(await aiRateLimiter.consumeKey('user-1')).toBe(false);
		const [, numKeys, key, max, rate, cost] = evalFn.mock.calls[0];
		expect([numKeys, key, max, rate, cost]).toEqual([
			1,
			`${RATE_LIMIT_KEY_PREFIX}ai:user-1`,
			15,
			0.2,
			1
		]);
	});

	it('does not touch the in-memory bucket when Redis answers', async () => {
		client.eval = vi.fn().mockResolvedValue(1);
		for (let i = 0; i < 20; i++) await aiRateLimiter.consumeKey('user-1');
		// Memory still has its full burst: Redis did the counting.
		expect(aiRateLimiter.tryConsumeKey('user-1')).toBe(true);
	});

	it('counts in memory when Redis cannot run the script', async () => {
		client.eval = vi.fn().mockRejectedValue(new Error('NOSCRIPT'));
		for (let i = 0; i < 15; i++) {
			expect(await aiRateLimiter.consumeKey('user-1'), `call ${i + 1}`).toBe(true);
		}
		expect(await aiRateLimiter.consumeKey('user-1')).toBe(false);
	});

	it('counts in memory when Redis is not connected', async () => {
		client.status = 'reconnecting';
		const evalFn = vi.fn();
		client.eval = evalFn;
		for (let i = 0; i < 15; i++) await aiRateLimiter.consumeKey('user-1');
		expect(await aiRateLimiter.consumeKey('user-1')).toBe(false);
		expect(evalFn).not.toHaveBeenCalled();
	});
});

describe('redisAuthRateLimitStorage', () => {
	const rule = { window: 60, max: 3 };

	it('passes window and max, namespaced under auth', async () => {
		const evalFn = vi.fn().mockResolvedValue([1, -1]);
		client.eval = evalFn;

		expect(await redisAuthRateLimitStorage.consume('1.2.3.4/sign-in/email', rule)).toEqual({
			allowed: true,
			retryAfter: null
		});
		const [, numKeys, key, window, max] = evalFn.mock.calls[0];
		expect([numKeys, key, window, max]).toEqual([
			1,
			`${RATE_LIMIT_KEY_PREFIX}auth:1.2.3.4/sign-in/email`,
			60,
			3
		]);
	});

	it('reports the window remainder as retryAfter when refused', async () => {
		client.eval = vi.fn().mockResolvedValue([0, 42]);
		expect(await redisAuthRateLimitStorage.consume('k', rule)).toEqual({
			allowed: false,
			retryAfter: 42
		});
	});

	it('falls back to a fixed window in memory, never to no limit', async () => {
		client.eval = vi.fn().mockRejectedValue(new Error('down'));
		for (let i = 0; i < 3; i++) {
			expect((await redisAuthRateLimitStorage.consume('k', rule)).allowed).toBe(true);
		}
		const refused = await redisAuthRateLimitStorage.consume('k', rule);
		expect(refused.allowed).toBe(false);
		expect(refused.retryAfter).toBeGreaterThan(0);
		expect(refused.retryAfter).toBeLessThanOrEqual(60);
		// Another key has its own window.
		expect((await redisAuthRateLimitStorage.consume('other', rule)).allowed).toBe(true);
	});
});
