/**
 * The MCP call counter: how many tool calls a user made in a period.
 *
 * Plain usage, so it lives here rather than in billing: the billing layer
 * decides what a period is and what the count allows, and both its versions
 * (the oss stub and the cloud overlay) count through this. See
 * `billing/require-mcp-allowance.ts` and planning/MCP-FREE-ALLOWANCE.md in
 * sjs-ops.
 */

import { sql } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { mcp_usage } from '$lib/server/db/schema';

/** Add one call to the user's count for `period`, and return the new count. */
export async function countMcpCall(userId: string, period: string): Promise<number> {
	const [row] = await db
		.insert(mcp_usage)
		.values({ user_id: userId, period, calls: 1 })
		.onConflictDoUpdate({
			target: [mcp_usage.user_id, mcp_usage.period],
			set: { calls: sql`${mcp_usage.calls} + 1` }
		})
		.returning({ calls: mcp_usage.calls });
	return row.calls;
}
