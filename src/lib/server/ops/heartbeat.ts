/**
 * The worker's heartbeat, which is how /api/health can tell a running worker
 * from a dead one. The app and the worker are separate processes, often on
 * separate restarts, and a worker that crashed leaves the site looking fine:
 * pages load, and nothing is scraped, matched or scheduled.
 *
 * The worker writes a timestamp every HEARTBEAT_INTERVAL_MS; the key expires
 * on its own well after that, so a dead worker reads as missing rather than
 * as a stale value someone has to compare.
 */

import { failOpen } from '../queue/redis-fail-open.js';

export const WORKER_HEARTBEAT_KEY = 'ops:worker:heartbeat';

/** How often the worker writes. */
export const HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * How old a heartbeat may be before the worker counts as down. Three missed
 * beats, so one slow tick or a quick restart does not flap the health check.
 */
export const HEARTBEAT_MAX_AGE_MS = 3 * HEARTBEAT_INTERVAL_MS;

export async function writeWorkerHeartbeat(now: number = Date.now()): Promise<void> {
	await failOpen('[Ops] heartbeat write', 'skipping this beat', (client) =>
		client.set(WORKER_HEARTBEAT_KEY, String(now), 'PX', HEARTBEAT_MAX_AGE_MS * 2)
	);
}

/**
 * Milliseconds since the worker last wrote, or null when there is no
 * heartbeat (worker down long enough for the key to expire, or never started)
 * or Redis cannot say.
 */
export async function workerHeartbeatAgeMs(now: number = Date.now()): Promise<number | null> {
	const raw = await failOpen('[Ops] heartbeat read', 'reporting the worker as unknown', (client) =>
		client.get(WORKER_HEARTBEAT_KEY)
	);
	if (raw === null) return null;
	const at = Number(raw);
	return Number.isFinite(at) ? Math.max(0, now - at) : null;
}
