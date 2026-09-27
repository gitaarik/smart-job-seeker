/**
 * How much an agent has already done to this profile without being asked.
 *
 * One query, in its own module, because it is the only *stateful* input to a
 * tier decision — `tiers.ts` is otherwise a pure function of the call and the
 * row, which is what makes its invariants testable by reading them. Keeping the
 * database out of there is worth a file.
 */

import { and, count, eq, exists, gte, notExists, or, sql } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import {
	agent_message_proposals,
	capability_edits,
	capability_requests
} from '$lib/server/db/schema';
import { DIRECT_WRITE_WINDOW_MS } from './tiers';

/**
 * Writes on this profile inside the window that nobody clicked for, from either
 * surface: a direct MCP write, or a chat entry the direct-write gate logged
 * (`ai-chat/direct-log.ts`). One ceiling per profile, so an agent cannot spend
 * the MCP allowance and then carry on through the chat, or the other way round.
 *
 * Approved requests are excluded. They are the ones a person looked at, and
 * counting them would make an applicant who reviews things carefully hit the
 * limit sooner than one who waves everything through — which is the wrong way
 * round. `notExists` rather than a join, so an approved change that was later
 * reverted still does not count. A chat change applied from its card is left
 * out for the same reason.
 */
export async function recentDirectWrites(profileId: number): Promise<number> {
	const since = new Date(Date.now() - DIRECT_WRITE_WINDOW_MS);

	const [row] = await db
		.select({ value: count() })
		.from(capability_edits)
		.where(
			and(
				eq(capability_edits.profile_id, profileId),
				gte(capability_edits.date_created, since),
				or(
					and(
						eq(capability_edits.source, 'mcp'),
						notExists(
							db
								.select({ one: sql`1` })
								.from(capability_requests)
								.where(eq(capability_requests.edit_id, capability_edits.id))
						)
					),
					and(
						eq(capability_edits.source, 'chat'),
						exists(
							db
								.select({ one: sql`1` })
								.from(agent_message_proposals)
								.where(
									and(
										eq(agent_message_proposals.id, capability_edits.proposal_id),
										eq(agent_message_proposals.disposition, 'direct')
									)
								)
						)
					)
				)
			)
		);

	return Number(row?.value ?? 0);
}
