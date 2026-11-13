/**
 * Redis commands that fail open: any error, any timeout, any connection that
 * will not come up reads as null, and the caller carries on as if Redis were
 * not there. For things that ride along on a paid call and must never delay or
 * fail it: the LLM response cache (llm/cache.ts) and the daily spend tally
 * (llm/spend-limit.ts).
 *
 * NOTE: relative import of the Redis client, for the reason given in
 * queue/redis.ts — this module is loaded from both SvelteKit and the worker.
 */

import { getRedisClient } from './redis.js';

export type RedisLike = ReturnType<typeof getRedisClient>;

/**
 * Ceiling on any one wait for Redis. A Redis on the same network answers a GET
 * in well under a millisecond, so this is not a budget — it is the line at
 * which we stop waiting and just call the model.
 */
const COMMAND_TIMEOUT_MS = 150;

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
 * turns every subsequent call into an immediate null.
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
 * unhandled rejection. `what` and `fallback` name the failure in the warning:
 * "[LLM cache] get failed, continuing without cache: …".
 */
export async function failOpen<T>(
	what: string,
	fallback: string,
	run: (client: RedisLike) => Promise<T>,
	timeoutMs: number = COMMAND_TIMEOUT_MS
): Promise<T | null> {
	const client = await readyClient(timeoutMs);
	if (!client) return null;

	return withDeadline(
		run(client).catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error);
			console.warn(`${what} failed, ${fallback}: ${message}`);
			return null;
		}),
		timeoutMs
	);
}
