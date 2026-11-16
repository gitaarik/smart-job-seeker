/**
 * Health check for an uptime monitor: 200 when the database, Redis and the
 * worker all answer, 503 naming which did not.
 *
 * Public on purpose (PUBLIC_API_ROUTES): the caller is a pinger with no
 * session. It reveals three booleans and nothing about users, versions or
 * configuration, and every check is bounded, so a hammering caller costs a
 * `SELECT 1` and two Redis reads.
 *
 * The worker is checked through its heartbeat (ops/heartbeat.ts), because a
 * dead worker is the outage nobody notices: pages keep loading while nothing
 * is scraped, matched or scheduled.
 */

import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { failOpen } from '$lib/server/queue/redis-fail-open';
import { HEARTBEAT_MAX_AGE_MS, workerHeartbeatAgeMs } from '$lib/server/ops/heartbeat';
import type { RequestHandler } from './$types';

const DB_TIMEOUT_MS = 3000;
const REDIS_TIMEOUT_MS = 1000;

async function databaseOk(): Promise<boolean> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const timeout = new Promise<false>((resolve) => {
			timer = setTimeout(() => resolve(false), DB_TIMEOUT_MS);
		});
		const query = db.execute(sql`SELECT 1`).then(
			() => true,
			() => false
		);
		return await Promise.race([query, timeout]);
	} finally {
		clearTimeout(timer);
	}
}

async function redisOk(): Promise<boolean> {
	const pong = await failOpen(
		'[Health] redis ping',
		'reporting redis down',
		(client) => client.ping(),
		REDIS_TIMEOUT_MS
	);
	return pong === 'PONG';
}

export const GET: RequestHandler = async () => {
	const [database, redis, heartbeatAge] = await Promise.all([
		databaseOk(),
		redisOk(),
		workerHeartbeatAgeMs()
	]);
	const worker = heartbeatAge !== null && heartbeatAge <= HEARTBEAT_MAX_AGE_MS;
	const ok = database && redis && worker;

	return json(
		{ status: ok ? 'ok' : 'degraded', checks: { database, redis, worker } },
		{ status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
	);
};
