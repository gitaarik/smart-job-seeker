/**
 * When a person last used SJS.
 *
 * Read by the idle rule in `spend-eligibility.ts`: matching and scheduled
 * searches stop for an account nobody has used for a month, and start again on
 * the next visit. Before it, the matcher went on scoring every new job for
 * accounts left months ago, charging their monthly credits for matches nobody
 * saw, and the scheduler went on running their saved searches.
 *
 * "Used" means a signed-in request (hooks.server.ts) or an MCP call
 * (`verifyMcpKey`). Not a device's tunnel traffic, which is a machine rather than
 * a person, and not an admin impersonating the account, which is the admin.
 *
 * This sits on the path of every request, so it is cheap and it cannot fail
 * one: at most one write an hour per account, fire and forget. The in-memory
 * throttle keeps it to one an hour per process; the WHERE clause keeps it to one
 * an hour across processes.
 */

import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';

/** How stale `last_seen_at` may get. The idle rule counts in days, so an hour is plenty. */
export const SEEN_STAMP_INTERVAL_MS = 60 * 60 * 1000;

/** When this process last stamped each account: one entry per account seen. */
const stampedAt = new Map<string, number>();

/** Record that `userId` is using SJS now. Never throws and never waits. */
export function recordSeen(userId: string, now: number = Date.now()): void {
	const last = stampedAt.get(userId);
	if (last !== undefined && now - last < SEEN_STAMP_INTERVAL_MS) return;
	stampedAt.set(userId, now);

	// Forget the throttle so the next request tries again. Logged, because a stamp
	// that fails every time would slowly pause a real user's matching.
	const failed = (e: unknown) => {
		stampedAt.delete(userId);
		console.warn('[last-seen] could not record use', e);
	};

	const staleBefore = new Date(now - SEEN_STAMP_INTERVAL_MS);
	try {
		db.update(users)
			.set({ last_seen_at: new Date(now) })
			.where(
				and(
					eq(users.id, userId),
					or(isNull(users.last_seen_at), lt(users.last_seen_at, staleBefore))
				)
			)
			.catch(failed);
	} catch (e) {
		// Thrown while building the query, before it ran. Caught here too, because
		// hooks.server.ts calls this on every request and a throw would fail them all.
		failed(e);
	}
}
