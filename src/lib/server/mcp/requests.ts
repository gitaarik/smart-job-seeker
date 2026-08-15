/**
 * Changes an agent asked for and a person decides on.
 *
 * The counterpart to `edit-log.ts`: that records writes that happened, this
 * records writes that were requested. HTTP-free for the same reason — the feed
 * page is one caller and the MCP router is another, and neither should be the
 * place the rules live.
 *
 * ## Approving is not a second write path
 *
 * `approveRequest` calls `executeCapability`, exactly as the chat's Apply button
 * does. So an approved request re-authorizes, re-coerces and re-validates
 * against a fresh read, lands in `capability_edits`, and is undoable from the
 * same feed as everything else. Nothing stored here is trusted on the way back
 * out: `fields` came from a model, through a client we do not control, and it
 * may have been sitting in this table for a week.
 *
 * ## Why there is no expiry
 *
 * A request that expires silently is a request the applicant never answered and
 * was never told about. Staleness is handled where it actually matters — at
 * approval, where `previous` is re-read and the diff shown is current — rather
 * than by deleting the evidence on a timer.
 */

import { dbDirect as db } from '$lib/server/db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { capability_requests } from '$lib/server/db/schema';
import {
	CAPABILITIES,
	executeCapability,
	type Capability,
	type CapabilityActor,
	type CapabilityTarget
} from '$lib/server/ai-chat/capabilities';

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface CapabilityRequest {
	id: number;
	capability: Capability;
	title: string;
	source: string;
	target: CapabilityTarget;
	fields: Record<string, unknown>;
	previous: Record<string, unknown>;
	/** The agent's own words. Untrusted text authored outside this application. */
	rationale: string;
	status: RequestStatus;
	createdAt: Date;
	decidedAt: Date | null;
	editId: number | null;
}

/** Where the applicant goes to decide. Absolute path, for a link an agent hands over. */
export function requestPath(id: number): string {
	return `/data/ai-changes#request-${id}`;
}

export async function createRequest(opts: {
	profileId: number;
	source: string;
	mcpKeyId: number | null;
	capability: Capability;
	target: CapabilityTarget;
	fields: Record<string, unknown>;
	previous: Record<string, unknown>;
	rationale: string;
}): Promise<number> {
	const [row] = await db
		.insert(capability_requests)
		.values({
			profile_id: opts.profileId,
			source: opts.source,
			mcp_key_id: opts.mcpKeyId,
			capability: opts.capability,
			target: opts.target,
			fields: opts.fields,
			previous: opts.previous,
			rationale: opts.rationale
		})
		.returning({ id: capability_requests.id });

	return row.id;
}

function toRequest(row: typeof capability_requests.$inferSelect): CapabilityRequest {
	const capability = row.capability as Capability;
	return {
		id: row.id,
		capability,
		// Same fallback as the edit log, for the same reason: a capability can leave
		// the registry while its history stays, and a feed that crashed on one would
		// be worse than one printing a raw name.
		title: CAPABILITIES[capability]?.title ?? capability,
		source: row.source,
		target: row.target,
		fields: row.fields,
		previous: row.previous,
		rationale: row.rationale,
		status: row.status as RequestStatus,
		createdAt: row.date_created,
		decidedAt: row.decided_at,
		editId: row.edit_id
	};
}

export async function readRequests(
	profileId: number,
	statuses: RequestStatus[] = ['pending']
): Promise<CapabilityRequest[]> {
	if (statuses.length === 0) return [];

	const rows = await db
		.select()
		.from(capability_requests)
		.where(
			and(
				eq(capability_requests.profile_id, profileId),
				inArray(capability_requests.status, statuses)
			)
		)
		.orderBy(desc(capability_requests.date_created), desc(capability_requests.id))
		.limit(100);

	return rows.map(toRequest);
}

export type DecisionRefusal = 'not_found' | 'already_decided' | 'failed';

export type DecisionOutcome =
	{ ok: true; editId: number | null } | { ok: false; reason: DecisionRefusal; error: string };

/**
 * Claim a pending request, so two clicks cannot both act on it.
 *
 * The status moves first and conditionally, before anything is written. A
 * request that was already decided updates nothing and the second caller is
 * told so — which is the same shape `revertEdit` uses, and for the same reason:
 * the alternative is a double write that both callers are told succeeded.
 */
async function claim(
	requestId: number,
	profileId: number,
	status: Exclude<RequestStatus, 'pending'>
): Promise<typeof capability_requests.$inferSelect | null> {
	const [row] = await db
		.update(capability_requests)
		.set({ status, decided_at: new Date() })
		.where(
			and(
				eq(capability_requests.id, requestId),
				eq(capability_requests.profile_id, profileId),
				eq(capability_requests.status, 'pending')
			)
		)
		.returning();

	return row ?? null;
}

export async function rejectRequest(
	requestId: number,
	actor: CapabilityActor
): Promise<DecisionOutcome> {
	const row = await claim(requestId, actor.profileId, 'rejected');
	if (!row) {
		return {
			ok: false,
			reason: 'already_decided',
			error: 'That request is no longer waiting for a decision.'
		};
	}
	return { ok: true, editId: null };
}

/**
 * Do what was asked, through the ordinary write path.
 *
 * On a refusal the request goes back to pending rather than staying claimed.
 * The alternative is a change the applicant approved, that did not happen, and
 * that they can no longer approve — which reads from the feed as though it
 * went through.
 */
export async function approveRequest(
	requestId: number,
	actor: CapabilityActor
): Promise<DecisionOutcome> {
	const row = await claim(requestId, actor.profileId, 'approved');
	if (!row) {
		return {
			ok: false,
			reason: 'already_decided',
			error: 'That request is no longer waiting for a decision.'
		};
	}

	const capability = row.capability as Capability;
	if (!CAPABILITIES[capability]) {
		await release(requestId);
		return {
			ok: false,
			reason: 'failed',
			error: 'That kind of change is no longer supported.'
		};
	}

	// `mcp` and not `approval`: the surface that asked is the fact worth
	// recording, and every row in this table was approved by a person — that is
	// what the table is for. A source of `approval` would erase the only
	// distinction the column exists to draw.
	const outcome = await executeCapability(capability, row.target, actor, row.fields, 'mcp');

	if (!outcome.ok) {
		await release(requestId);
		return { ok: false, reason: 'failed', error: outcome.error };
	}

	await db
		.update(capability_requests)
		.set({ edit_id: outcome.editId })
		.where(eq(capability_requests.id, requestId));

	return { ok: true, editId: outcome.editId };
}

async function release(requestId: number): Promise<void> {
	await db
		.update(capability_requests)
		.set({ status: 'pending', decided_at: null })
		.where(eq(capability_requests.id, requestId));
}
