/**
 * Shared Redis client for simple key-value operations
 * Uses ioredis (already installed as a BullMQ dependency)
 *
 * NOTE: Uses environment variables directly (not $lib/server/config)
 * so this module can be imported from both SvelteKit and the worker.
 */

import Redis from 'ioredis';
type RedisClient = InstanceType<typeof Redis>;

let redisClient: RedisClient | null = null;

/**
 * Get or create the shared Redis client
 */
export function getRedisClient(): RedisClient {
	if (!redisClient) {
		redisClient = new Redis({
			host: process.env.REDIS_HOST || 'localhost',
			port: parseInt(process.env.REDIS_PORT || '6379'),
			maxRetriesPerRequest: 3,
			lazyConnect: true
		});

		redisClient.on('error', (err) => {
			console.error('[Redis] Client error:', err.message);
		});
	}

	return redisClient;
}
