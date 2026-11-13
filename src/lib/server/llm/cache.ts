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
 * Not every call looks here. A writing call runs because someone asked for a
 * text, and a repeat of it asks for a different one, so those pass
 * `cache: false` and neither read nor write (ChatCompletionOptions.cache in
 * langchain.ts). What is left is the judgements and extractions, where the
 * same input should give the same output.
 *
 * NOTE: relative import of the Redis helpers, for the reason given in
 * queue/redis.ts — this module is loaded from both SvelteKit and the worker.
 */

import { createHash } from 'node:crypto';
import { failOpen, type RedisLike } from '../queue/redis-fail-open.js';

/**
 * Key namespace. Everything the cache owns lives under it, so the SCAN in
 * clear() can never reach a queue, matcher-state or BullMQ key.
 */
const KEY_PREFIX = 'llm:cache:';

/** Fallback TTL in ms when the caller passes none. Callers pass config.llmCacheTTL. */
const DEFAULT_TTL_MS = 1000 * 60 * 60;

/** clear() walks the keyspace, so it gets room the single-key path doesn't need. */
const CLEAR_TIMEOUT_MS = 5000;

/** One Redis command for the cache, read as a miss on any failure (redis-fail-open.ts). */
function attempt<T>(
	what: string,
	run: (client: RedisLike) => Promise<T>,
	timeoutMs?: number
): Promise<T | null> {
	return failOpen(`[LLM cache] ${what}`, 'continuing without cache', run, timeoutMs);
}

class LLMCache {
	/** Set by disable(), and never unset. */
	private disabled = false;

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
		if (this.disabled) return null;
		return attempt('get', (client) => client.get(this.keyFor(prompt, model)));
	}

	/** Store a response. TTL is in milliseconds, matching config.llmCacheTTL. */
	async set(prompt: string, response: string, model?: string, ttl?: number): Promise<void> {
		if (this.disabled) return;
		const ttlMs = Math.max(1, Math.floor(ttl || DEFAULT_TTL_MS));
		await attempt('set', (client) => client.set(this.keyFor(prompt, model), response, 'PX', ttlMs));
	}

	/**
	 * Read nothing and store nothing, for the rest of this process.
	 *
	 * For scripts that measure the model rather than use it: the golden sets and
	 * llm:smoke. They send the same prompt again on purpose, as a repeat or as a
	 * re-run, and a prompt is its own key, so all but the first would come back
	 * from here as calls that used no tokens. That is how a golden run's three
	 * repeats per case were really one or two answers and copies, and how a
	 * re-run within the TTL replayed the previous run whole while reporting
	 * itself as a fresh one. Nothing in the app calls this.
	 */
	disable(): void {
		this.disabled = true;
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
