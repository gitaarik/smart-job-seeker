/**
 * Redis connection configuration for BullMQ
 */

import type { ConnectionOptions } from 'bullmq';
import { config } from '$lib/server/config';

export const redisConnection: ConnectionOptions = {
	host: config.redisHost,
	port: config.redisPort,
	/**
	 * Pin the RESP2 wire protocol.
	 *
	 * ioredis 6 changed the default to RESP3, and BullMQ has no opinion about
	 * it: it forwards these options straight to ioredis and never mentions the
	 * protocol anywhere in its own connection code. It also takes ioredis as a
	 * **peer** dependency, so there is no private copy to insulate it — bumping
	 * ours moves the wire protocol underneath the queue itself, not just the
	 * shared KV client.
	 *
	 * RESP3 delivers pub/sub as push messages on the same connection and changes
	 * the reply shape of several commands, and BullMQ leans on blocking commands
	 * for exactly that machinery. Nothing here wants RESP3, so pinning keeps the
	 * bump a dependency change rather than a behaviour change. This queue has
	 * jammed before; it does not need a protocol switch nobody asked for.
	 */
	protocol: 2
};
