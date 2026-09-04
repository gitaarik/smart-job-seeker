/**
 * LLM response cache, backed by Redis.
 *
 * Why not the Map this used to be: the app and the worker are separate
 * processes and both generate. A per-process cache can never share a hit
 * between them, so the same prompt was paid for twice as a matter of course,
 * and every restart or redeploy threw the whole thing away.
 *
 * The cache is an optimisation ON a paid call, never a dependency OF one.
 * Every Redis touch below fails open: any error, any timeout, any connection
 * that will not come up reads as a miss, a write is dropped, and the
 * generation proceeds exactly as it would with no cache at all. Nothing here
 * is allowed to turn a Redis problem into a failed or delayed LLM call.
 *
 * NOTE: relative import of the Redis client, for the reason given in
 * queue/redis.ts — this module is loaded from both SvelteKit and the worker.
 */

import { createHash } from 'node:crypto';
import { getRedisClient } from '../queue/redis.js';

type RedisLike = ReturnType<typeof getRedisClient>;

/**
 * Key namespace. Everything the cache owns lives under it, so the SCAN in
 * clear() can never reach a queue, matcher-state or BullMQ key.
 */
const KEY_PREFIX = 'llm:cache:';

/** Fallback TTL in ms when the caller passes none. Callers pass config.llmCacheTTL. */
const DEFAULT_TTL_MS = 1000 * 60 * 60;

/**
 * Ceiling on any one wait for Redis. A Redis on the same network answers a GET
 * in well under a millisecond, so this is not a budget — it is the line at
 * which we stop waiting and just call the model.
 */
const COMMAND_TIMEOUT_MS = 150;

/** clear() walks the keyspace, so it gets room the single-key path doesn't need. */
const CLEAR_TIMEOUT_MS = 5000;

/** Resolve `promise`, or null if it has not settled within `timeoutMs`. */
async function withDeadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const deadline = new Promise<null>((resolve) => {
			timer = setTimeout(() => resolve(null), timeoutMs);
		});
		return await Promise.race([promise, deadline]);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * The shared client, but only once it can actually answer.
 *
 * ioredis keeps an offline queue: a command issued while the connection is
 * down is held rather than rejected, and settles whenever Redis comes back.
 * That is what matcher-state wants from the shared client and the exact
 * opposite of what a cache wants, since it would turn a Redis outage into a
 * generation that never returns. So nothing is sent unless the socket is up.
 *
 * The client is lazyConnect, so whoever gets here first has to open it. That
 * wait is bounded by the same deadline a command gets, which means an
 * unreachable Redis costs one generation 150ms and every later one nothing:
 * the failed client is left in 'reconnecting', and the status check below
 * turns every subsequent call into an immediate miss.
 */
async function readyClient(timeoutMs: number): Promise<RedisLike | null> {
	let client: RedisLike;
	try {
		client = getRedisClient();
	} catch {
		return null;
	}

	if (client.status === 'ready') return client;

	// Anything already mid-flight ('connecting', 'reconnecting', 'close', 'end')
	// is left alone — a command now would only park in the offline queue.
	if (client.status !== 'wait') return null;

	const opened = await withDeadline(
		// connect() rejects if the socket fails, and throws synchronously if a
		// concurrent first call got there first. Both mean "not this time".
		Promise.resolve()
			.then(() => client.connect())
			.then(
				() => true,
				() => false
			),
		timeoutMs
	);

	// connect() resolves on 'ready', so that is the whole answer. Re-reading
	// status here would buy nothing: should the socket drop again in between,
	// the command that follows carries the same deadline as any other.
	return opened === true ? client : null;
}

/**
 * Run one Redis command, degrading to null on error, timeout or a client that
 * will not come up. A command still in flight when the deadline passes is left
 * to settle on its own; it carries its own catch, so it cannot surface as an
 * unhandled rejection.
 */
async function attempt<T>(
	what: string,
	run: (client: RedisLike) => Promise<T>,
	timeoutMs: number = COMMAND_TIMEOUT_MS
): Promise<T | null> {
	const client = await readyClient(timeoutMs);
	if (!client) return null;

	return withDeadline(
		run(client).catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error);
			console.warn(`[LLM cache] ${what} failed, continuing without cache: ${message}`);
			return null;
		}),
		timeoutMs
	);
}

class LLMCache {
	/**
	 * sha256 of model + prompt.
	 *
	 * Entries are immutable by construction: a different prompt or a different
	 * model is a different key, so a cached value can never go stale and there
	 * is nothing to invalidate. Expiry is the only lifecycle, and Redis runs it.
	 */
	private keyFor(prompt: string, model?: string): string {
		const content = model ? `${model}:${prompt}` : prompt;
		return KEY_PREFIX + createHash('sha256').update(content).digest('hex');
	}

	/** Cached response, or null for a miss — including every failure mode. */
	async get(prompt: string, model?: string): Promise<string | null> {
		return attempt('get', (client) => client.get(this.keyFor(prompt, model)));
	}

	/** Store a response. TTL is in milliseconds, matching config.llmCacheTTL. */
	async set(prompt: string, response: string, model?: string, ttl?: number): Promise<void> {
		const ttlMs = Math.max(1, Math.floor(ttl || DEFAULT_TTL_MS));
		await attempt('set', (client) => client.set(this.keyFor(prompt, model), response, 'PX', ttlMs));
	}

	/**
	 * Drop every cached response.
	 *
	 * Not part of normal operation — Redis expires entries by itself. This is
	 * for tests, and for purging by hand after a prompt or model change that
	 * should not be answered from yesterday's cache.
	 */
	async clear(): Promise<void> {
		await attempt(
			'clear',
			async (client) => {
				let cursor = '0';
				do {
					const [next, keys] = await client.scan(cursor, 'MATCH', `${KEY_PREFIX}*`, 'COUNT', 100);
					cursor = next;
					if (keys.length > 0) await client.del(...keys);
				} while (cursor !== '0');
				return null;
			},
			CLEAR_TIMEOUT_MS
		);
	}
}

// Export singleton instance
export const llmCache = new LLMCache();
