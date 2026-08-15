/**
 * How much an agent has already done to this profile without being asked.
 *
 * One query, in its own module, because it is the only *stateful* input to a
 * tier decision — `tiers.ts` is otherwise a pure function of the call and the
 * row, which is what makes its invariants testable by reading them. Keeping the
 * database out of there is worth a file.
 */

import { and, count, eq, gte, notExists, sql } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { capability_edits, capability_requests } from '$lib/server/db/schema';
import { DIRECT_WRITE_WINDOW_MS } from './tiers';

/**
 * Direct MCP writes on this profile inside the window.
 *
 * Approved requests are excluded. They are the ones a person looked at, and
 * counting them would make an applicant who reviews things carefully hit the
 * limit sooner than one who waves everything through — which is the wrong way
 * round. `notExists` rather than a join, so an approved change that was later
 * reverted still does not count.
 */
export async function recentDirectWrites(profileId: number): Promise<number> {
	const since = new Date(Date.now() - DIRECT_WRITE_WINDOW_MS);

	const [row] = await db
		.select({ value: count() })
		.from(capability_edits)
		.where(
			and(
				eq(capability_edits.profile_id, profileId),
				eq(capability_edits.source, 'mcp'),
				gte(capability_edits.date_created, since),
				notExists(
					db
						.select({ one: sql`1` })
						.from(capability_requests)
						.where(eq(capability_requests.edit_id, capability_edits.id))
				)
			)
		);

	return Number(row?.value ?? 0);
}
