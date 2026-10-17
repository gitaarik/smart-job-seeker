/**
 * A proposal from the model, validated: what the chat stores as a card.
 *
 * Lifted from the agent route, where it validated one entry of the structured
 * reply's `proposals` list, so that the agent's executor (executor.ts) can
 * hold a write tool call to the same checks: a capability live on this turn,
 * a target among the rows it was authorized for, fields coerced and none of
 * them empty, the capability's own validate. Both callers get the same
 * StoredProposal, stored in the same place, and the same reason for a drop.
 */
import {
	CAPABILITIES,
	type Capability,
	type CapabilityActor,
	fieldsFromChanges,
	type LiveCapability
} from '$lib/server/ai-chat/capabilities';
import { traceStep } from '$lib/server/monitoring/telemetry';

/** A validated proposal, ready to store against the assistant turn. */
export type StoredProposal = {
	capability: string;
	rationale: string;
	fields: Record<string, unknown>;
	/** What those fields hold right now, so the diff survives being applied. */
	previous: Record<string, unknown>;
	target: { id: number; label: string };
};

/** One proposal as the model put it, before any of it is trusted. */
export type ProposalCandidate = {
	capability?: unknown;
	target_id?: unknown;
	rationale?: unknown;
	changes?: unknown;
};

/**
 * A proposal that didn't survive, and what to tell the user about it.
 *
 * `what` names the change in the user's terms — a capability title where we
 * have one, since the ids are ours and mean nothing to them.
 */
export type DroppedProposal = { what: string | null; why: string };

export type ReadProposal =
	{ ok: true; proposal: StoredProposal } | { ok: false; drop: DroppedProposal };

/**
 * Validate one candidate against the capabilities that were live this turn.
 * Anything unusable is dropped — see the route's readCapableReply for why that
 * is never an error — but it is dropped *with a reason*, because the reply
 * that came back alongside it has usually already promised the user the
 * change, and the agent's model is answered with it so it can correct the call.
 */
export async function readProposal(
	candidate: ProposalCandidate,
	live: LiveCapability[],
	actor: CapabilityActor,
	options: {
		/**
		 * A named row must be one of the live rows even when there is only one.
		 * The structured reply says to omit the id when one row is listed, so a
		 * stray id there is forgiven and the one row taken; the agent's tools
		 * ask for the id every time, so there one that is not this row is a
		 * different row, and the call is refused rather than landed here.
		 */
		strictTarget?: boolean;
	} = {}
): Promise<ReadProposal> {
	if (!candidate || typeof candidate.capability !== 'string') {
		return {
			ok: false,
			drop: { what: null, why: "it didn't name a change to make" }
		};
	}

	// Only a capability that was live for *this* turn, i.e. one already resolved
	// and authorized above. A model naming anything else is ignored outright.
	const match = live.find((c) => c.capability === candidate.capability);
	if (!match) {
		console.warn(`[agent] dropped a proposal for un-live capability ${candidate.capability}`);
		return {
			ok: false,
			drop: {
				what: titleFor(candidate.capability),
				why: "that isn't something you can change from this page"
			}
		};
	}

	const title = CAPABILITIES[match.capability].title;

	// Which row. One live row needs no naming and the model is not asked for it;
	// several means it must pick, and it may only pick from the list it was
	// shown — every entry of which was authorized before it was rendered. An id
	// outside that list is not resolved and looked up, it is refused: the whole
	// rule is that the model may NAME a row, never reach one.
	const named = candidate.target_id !== undefined && candidate.target_id !== null;
	const target =
		match.targets.length === 1 && !(named && options.strictTarget)
			? match.targets[0]
			: match.targets.find((t) => t.id === Number(candidate.target_id));

	if (!target) {
		console.warn(
			`[agent] dropped a proposal for ${match.capability}: target_id ${String(candidate.target_id)}`
		);
		return {
			ok: false,
			drop: {
				what: title,
				why: named ? "it named one that isn't on this page" : "it didn't say which one to change"
			}
		};
	}

	const changes = Array.isArray(candidate.changes) ? candidate.changes : [];
	const fields = fieldsFromChanges(
		match.capability,
		changes as { field: string; value: unknown }[]
	);
	// A fieldless verb — hiding a row — is complete once it has named one. Only
	// a capability that asked for values and got none is empty.
	if (
		Object.keys(CAPABILITIES[match.capability].fields).length > 0 &&
		Object.keys(fields).length === 0
	) {
		console.warn(`[agent] dropped an empty proposal for ${match.capability}`);
		return {
			ok: false,
			// The common cause is a field name belonging to a different capability:
			// the wire schema offers every live capability's names under one enum,
			// so the model can file a job field under an application proposal, and
			// fieldsFromChanges drops what doesn't belong.
			drop: { what: title, why: 'it came back with no usable fields' }
		};
	}

	// Read for the named row, not off the live capability: with several rows
	// there is no single `current`, and validating an edit to one row against
	// another row's values is how a check passes for the wrong reason.
	const current = match.current ?? (await CAPABILITIES[match.capability].current(target, actor));

	const valid = CAPABILITIES[match.capability].validate(fields, current);
	if (!valid.ok) {
		console.warn(`[agent] dropped an invalid proposal: ${valid.error}`);
		return { ok: false, drop: { what: title, why: valid.error } };
	}

	return {
		ok: true,
		proposal: {
			capability: match.capability,
			rationale: typeof candidate.rationale === 'string' ? candidate.rationale : '',
			fields,
			// Narrowed to the proposed fields — the whole `current` blob would store
			// a row snapshot rather than a before-image of this edit, and the two
			// drift apart the moment a capability grows a field.
			previous: Object.fromEntries(
				Object.keys(fields)
					.filter((key) => key in current)
					.map((key) => [key, current[key]])
			),
			target
		}
	};
}

/**
 * One proposal as a `tool` observation of the turn's trace: what the model asked
 * for, and what became of it. A dropped one is a WARNING with the reason the
 * user was given.
 */
export function traceProposal(
	candidate: ProposalCandidate,
	read: () => Promise<ReadProposal>
): Promise<ReadProposal> {
	const name = typeof candidate?.capability === 'string' ? candidate.capability : 'propose_change';
	return traceStep(name, 'tool', read, (result) =>
		result.ok
			? {
					input: candidate,
					output: { target: result.proposal.target, fields: result.proposal.fields }
				}
			: { input: candidate, level: 'WARNING', statusMessage: result.drop.why }
	);
}

/** A capability's user-facing name, when it names one we know. */
export function titleFor(capability: string): string | null {
	return capability in CAPABILITIES ? CAPABILITIES[capability as Capability].title : null;
}

/**
 * One card per capability AND row. A model that splits the same edit across
 * two entries would otherwise render two cards over one row, where applying
 * both means the second silently overwrites the first.
 *
 * Keyed on the row as well as the capability, because since a capability can
 * be live over a list, two entries naming DIFFERENT rows are two real edits
 * — "rename this language and that one" is one capability and two cards.
 * Keying on the capability alone would have silently dropped the second.
 *
 * Not reported as a drop: both entries are the same KIND of change over the
 * same row, so the user still gets a card for what the reply described.
 * Telling them one was discarded would describe our deduplication, not a
 * change they're missing.
 */
export function dedupeProposals(proposals: StoredProposal[]): StoredProposal[] {
	const seen = new Set<string>();
	return proposals.filter((p) => {
		const key = `${p.capability}:${p.target.id}`;
		if (seen.has(key)) {
			console.warn(`[agent] dropped a duplicate proposal for ${key}`);
			return false;
		}
		seen.add(key);
		return true;
	});
}

/**
 * The note appended to a reply when a change it describes never became a card.
 *
 * This exists because the reply and the proposals fail independently. The model
 * writes "I've corrected the salary and rewritten the description", and if the
 * salary entry doesn't validate the user gets that sentence with one card under
 * it and nothing saying why — a promise silently half-kept, which reads as the
 * assistant lying rather than as a check doing its job.
 *
 * Written in the user's terms, not ours: capability ids are internal, so a drop
 * we can't name says only that something didn't come through.
 */
export function renderDropNotice(drops: DroppedProposal[]): string {
	if (drops.length === 0) return '';

	const lines = drops.map(({ what, why }) =>
		what ? `- **${what}** — ${why}.` : `- One change didn't come through: ${why}.`
	);

	return `---\n\n${
		drops.length === 1
			? "*One change I described couldn't be offered:*"
			: "*Some changes I described couldn't be offered:*"
	}\n\n${lines.join('\n')}\n\n*Ask again and I'll retry it.*`;
}
