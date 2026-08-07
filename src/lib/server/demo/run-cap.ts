/**
 * Per-link scrape-run cap for demo users.
 *
 * Each demo link can set a `max_runs` ceiling so a single demo can't drain the
 * host's credits or pound their device beyond the device-rate budget. Counts
 * the demo user's runs (across their cloned profile's tasks) against the cap.
 */

import { count, eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { demo_links, profiles, search_task_runs, search_tasks } from '$lib/server/db/schema';

export interface DemoRunCapResult {
	allowed: boolean;
	used: number;
	max: number | null;
}

/**
 * Check whether a demo user may start another run. Returns allowed=true (with
 * max=null) for demo users whose link has no cap, or if no link is found.
 */
export async function checkDemoRunCap(demoUserId: string): Promise<DemoRunCapResult> {
	const link = await db.query.demo_links.findFirst({
		where: eq(demo_links.demo_user_id, demoUserId),
		columns: { max_runs: true }
	});
	if (!link || link.max_runs == null) {
		return { allowed: true, used: 0, max: null };
	}

	// Runs the demo user has triggered = runs whose task's profile is theirs.
	const [{ value }] = await db
		.select({ value: count() })
		.from(search_task_runs)
		.innerJoin(search_tasks, eq(search_tasks.id, search_task_runs.search_task_id))
		.innerJoin(profiles, eq(profiles.id, search_tasks.profile_id))
		.where(eq(profiles.user_id, demoUserId));

	return { allowed: value < link.max_runs, used: value, max: link.max_runs };
}
