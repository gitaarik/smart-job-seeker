/**
 * Redis connection configuration for BullMQ
 */

import type { ConnectionOptions } from 'bullmq';
import { config } from '$lib/server/config';

export const redisConnection: ConnectionOptions = {
	host: config.redisHost,
	port: config.redisPort
};
