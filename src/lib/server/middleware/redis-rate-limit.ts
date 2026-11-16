/**
 * Rate-limit counters in Redis, so a limit survives a deploy and holds across
 * every app process instead of each one keeping its own.
 *
 * Two shapes, because the two limiters in this app count differently:
 *
 * - `consumeTokenBucket` backs `RateLimiter` (rate-limit.ts): a bucket of
 *   `maxTokens` that refills continuously at `refillRate` per second.
 * - `redisAuthRateLimitStorage` backs better-auth's `rateLimit.customStorage`:
 *   a fixed window of `window` seconds allowing `max` requests, the semantics
 *   better-auth's own memory and database stores have.
 *
 * Both run as one Lua script, so the read and the write are a single atomic
 * step: N concurrent requests cannot all pass a stale read before any of them
 * lands, which is the gap better-auth closed when it dropped get/set storage.
 *
 * Both fail open to an in-process counter. A Redis that is down, slow or
 * missing must never turn into "nobody can sign in", and the per-process
 * fallback still limits, it just forgets on restart, which is exactly what the
 * in-memory stores did before this file existed.
 */

import type { BetterAuthOptions } from 'better-auth';
import { failOpen } from '../queue/redis-fail-open.js';

/** better-auth's custom-storage shape, named without depending on @better-auth/core directly. */
type BetterAuthRateLimitStorage = NonNullable<
	NonNullable<BetterAuthOptions['rateLimit']>['customStorage']
>;

/** Every key this file writes starts here, so they are easy to find and clear. */
export const RATE_LIMIT_KEY_PREFIX = 'ratelimit:';

/**
 * Refill, then try to take `cost` tokens. Returns 1 if taken, 0 if not.
 *
 * Time comes from the Redis server (TIME), not the caller, so two app nodes
 * with drifting clocks still agree on how much a bucket has refilled. Scripts
 * may call TIME since Redis 5 replicates their effects rather than the script.
 *
 * The key expires once a full bucket would have refilled, plus a second, so an
 * idle bucket costs nothing: reading a missing key and reading a full one give
 * the same answer.
 */
const TOKEN_BUCKET_SCRIPT = `
local max = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local b = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(b[1])
local ts = tonumber(b[2])
if tokens == nil or ts == nil then
  tokens = max
  ts = now
end
tokens = math.min(max, tokens + (math.max(0, now - ts) / 1000) * rate)
local allowed = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
end
redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'ts', tostring(now))
redis.call('PEXPIRE', KEYS[1], math.ceil(max / rate * 1000) + 1000)
return allowed
`;

/**
 * Count one request in a fixed window. Returns {1, -1} if allowed, or
 * {0, seconds-until-the-window-ends} if the limit was already reached.
 *
 * The window starts on the first request and the key expires with it. The
 * TTL repair covers a key that somehow lost its expiry (a PERSIST by hand, a
 * crash between INCR and EXPIRE on a Redis without scripts' atomicity), which
 * would otherwise lock that key out for good.
 */
const FIXED_WINDOW_SCRIPT = `
local window = tonumber(ARGV[1])
local max = tonumber(ARGV[2])
local n = redis.call('INCR', KEYS[1])
if n == 1 then
  redis.call('EXPIRE', KEYS[1], window)
end
if n > max then
  local ttl = redis.call('TTL', KEYS[1])
  if ttl < 0 then
    redis.call('EXPIRE', KEYS[1], window)
    ttl = window
  end
  return {0, ttl}
end
return {1, -1}
`;

/**
 * The Redis answer for a token bucket: true or false, or null when Redis could
 * not answer and the caller should count in memory instead.
 */
export async function consumeTokenBucket(
	key: string,
	maxTokens: number,
	refillRate: number,
	cost: number = 1
): Promise<boolean | null> {
	const result = await failOpen(
		'[Rate limit] token bucket',
		'counting in memory',
		async (client) =>
			client.eval(
				TOKEN_BUCKET_SCRIPT,
				1,
				RATE_LIMIT_KEY_PREFIX + key,
				maxTokens,
				refillRate,
				cost
			) as Promise<number>
	);
	return result === null ? null : result === 1;
}

/** One fixed-window counter per key, for when Redis cannot answer. */
const memoryWindows = new Map<string, { count: number; resetAt: number }>();
const MEMORY_SWEEP_THRESHOLD = 5000;

function consumeFixedWindowInMemory(
	key: string,
	window: number,
	max: number
): { allowed: boolean; retryAfter: number | null } {
	const now = Date.now();
	let entry = memoryWindows.get(key);
	if (!entry || entry.resetAt <= now) {
		if (memoryWindows.size >= MEMORY_SWEEP_THRESHOLD) {
			for (const [k, e] of memoryWindows) if (e.resetAt <= now) memoryWindows.delete(k);
		}
		entry = { count: 0, resetAt: now + window * 1000 };
		memoryWindows.set(key, entry);
	}
	if (entry.count >= max) {
		return { allowed: false, retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
	}
	entry.count++;
	return { allowed: true, retryAfter: null };
}

/** Test hook: forget every in-memory fallback window. */
export function resetMemoryWindows(): void {
	memoryWindows.clear();
}

/**
 * better-auth's `rateLimit.customStorage`. Keys arrive as better-auth builds
 * them (client IP plus path), and are namespaced here under `auth:`.
 */
export const redisAuthRateLimitStorage: BetterAuthRateLimitStorage = {
	async consume(key, rule) {
		const fullKey = `auth:${key}`;
		const result = await failOpen(
			'[Rate limit] auth window',
			'counting in memory',
			async (client) =>
				client.eval(
					FIXED_WINDOW_SCRIPT,
					1,
					RATE_LIMIT_KEY_PREFIX + fullKey,
					rule.window,
					rule.max
				) as Promise<[number, number]>
		);
		if (result === null) return consumeFixedWindowInMemory(fullKey, rule.window, rule.max);
		const [allowed, ttl] = result;
		return allowed === 1
			? { allowed: true, retryAfter: null }
			: { allowed: false, retryAfter: Math.max(1, ttl) };
	}
};
