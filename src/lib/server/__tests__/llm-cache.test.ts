/**
 * Tests for the Redis-backed LLM response cache.
 *
 * The happy path is covered end to end by llm.test.ts ("should use cache for
 * repeated requests"). What is worth its own file is the behaviour under a
 * Redis that is broken or absent, because the whole contract of this module is
 * that a cache problem is never a generation problem: every failure has to
 * read as a miss, and none of them may throw or hang.
 *
 * ioredis is replaced by an in-memory stand-in globally (vitest.setup.ts), so
 * `getRedisClient()` here hands back a FakeRedis whose methods can be made to
 * misbehave on demand.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { llmCache } from '../llm/cache';
import { getRedisClient } from '../queue/redis';

/** The stand-in behind getRedisClient(), typed for poking at in tests. */
const client = getRedisClient() as unknown as {
	status: string;
	get(key: string): Promise<string | null>;
	set(key: string, value: string, unit?: string, ttl?: number): Promise<'OK'>;
	scan(cursor: string, match: string, pattern: string, count: string, n: number): Promise<never>;
};

describe('the LLM response cache', () => {
	beforeEach(async () => {
		await llmCache.clear();
		client.status = 'ready';
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns what was stored', async () => {
		await llmCache.set('a prompt', 'an answer', 'some-model');
		expect(await llmCache.get('a prompt', 'some-model')).toBe('an answer');
	});

	it('is a miss for an unseen prompt', async () => {
		expect(await llmCache.get('never asked', 'some-model')).toBeNull();
	});

	it('keys by model, so the same prompt on another model is a miss', async () => {
		await llmCache.set('a prompt', 'an answer', 'model-a');
		expect(await llmCache.get('a prompt', 'model-b')).toBeNull();
	});

	it('expires an entry once its TTL has passed', async () => {
		await llmCache.set('a prompt', 'an answer', 'some-model', 20);
		await new Promise((resolve) => setTimeout(resolve, 60));
		expect(await llmCache.get('a prompt', 'some-model')).toBeNull();
	});

	/**
	 * The cache shares one Redis with the queues, matcher state and BullMQ, so
	 * its own purge has to stay inside its namespace. A clear() that reached
	 * further would take out running jobs.
	 */
	it('clears only its own keys', async () => {
		await llmCache.set('a prompt', 'an answer', 'some-model');
		await client.set('matcher:state:1', 'not the cache');

		await llmCache.clear();

		expect(await llmCache.get('a prompt', 'some-model')).toBeNull();
		expect(await client.get('matcher:state:1')).toBe('not the cache');
	});

	describe('when Redis is broken', () => {
		it('reads as a miss instead of throwing', async () => {
			vi.spyOn(client, 'get').mockRejectedValue(new Error('READONLY'));
			await expect(llmCache.get('a prompt', 'some-model')).resolves.toBeNull();
		});

		it('drops the write instead of throwing', async () => {
			vi.spyOn(client, 'set').mockRejectedValue(new Error('OOM'));
			await expect(llmCache.set('a prompt', 'an answer', 'some-model')).resolves.toBeUndefined();
		});

		/**
		 * The reason for the status check in readyClient(). ioredis holds commands
		 * in an offline queue while disconnected rather than rejecting them, so
		 * issuing one here would leave the generation waiting on a Redis that may
		 * never come back.
		 */
		it('sends no command at all while the connection is down', async () => {
			const get = vi.spyOn(client, 'get');
			client.status = 'end';

			await expect(llmCache.get('a prompt', 'some-model')).resolves.toBeNull();
			expect(get).not.toHaveBeenCalled();
		});

		it('gives up on a command that never settles', async () => {
			vi.spyOn(client, 'get').mockReturnValue(new Promise<string | null>(() => {}));
			await expect(llmCache.get('a prompt', 'some-model')).resolves.toBeNull();
		});
	});
});
