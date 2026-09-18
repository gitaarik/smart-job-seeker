/**
 * The record of what the assistant was allowed to propose on one turn.
 *
 * The sibling of documents/retrieval-record.ts, for writes instead of reads, and
 * it exists for the same reason: the decision is made per turn, it is not
 * obvious, and until now it left no trace. Three tiers compete for a 22,000-char
 * block — the page's own subject, the child collections on that page, and
 * whatever sections the conversation named that the page does not grant — and
 * `fitMatchedCapabilities` admits groups while they fit. A section that matched
 * and then lost that race is indistinguishable, from the outside, from one the
 * matcher never found: both end as an assistant that did not offer the edit.
 *
 * "Why didn't it offer to fix my skill" has three different answers (never
 * matched, matched but unauthorized, matched and did not fit) and they call for
 * three different fixes. This is what tells them apart.
 *
 * STAFF ONLY. Unlike the retrieval record there is no applicant-facing half:
 * what the assistant can change is already stated to the user in the reply
 * itself, and in the proposal cards under it. This is about why the machine
 * offered what it did.
 */

import type { LiveCapability } from './capabilities';

/** Which competing group a capability came from. */
export type CapabilityTier =
	/** The page's own subject. Never dropped — it is what the page promised. */
	| 'subject'
	/** Collections belonging to the subject row, on the same page. */
	| 'child'
	/** A section the conversation named that this page does not grant. */
	| 'matched';

/** One capability that was resolved for this turn, admitted or not. */
export interface CapabilityEntry {
	capability: string;
	tier: CapabilityTier;
	/** How many rows it was authorized to act on. */
	targets: number;
	/** False when its group did not fit the block budget. */
	admitted: boolean;
}

/** What the assistant could propose on one turn, and what it nearly could. */
export interface CapabilityRecord {
	entries: CapabilityEntry[];
	/** Rendered size of the admitted block, chars. 0 when nothing was admitted. */
	chars: number;
	/** The block budget the above was packed into. */
	budgetChars: number;
}

/**
 * Distil one turn's capability resolution into the record.
 *
 * Admission is matched by capability name, which is sound because a name
 * reaches exactly one tier: `tieredCapabilities` splits the route's declared
 * list, and `matchedCapabilities` excludes every section the route already
 * grants, so nothing can be resolved twice.
 */
export function buildCapabilityRecord(parts: {
	subject: LiveCapability[];
	children: LiveCapability[][];
	matched: LiveCapability[][];
	/** What survived fitMatchedCapabilities. */
	admitted: LiveCapability[];
	chars: number;
	budgetChars: number;
}): CapabilityRecord {
	const admittedNames = new Set(parts.admitted.map((c) => c.capability));

	const entriesFor = (group: LiveCapability[], tier: CapabilityTier): CapabilityEntry[] =>
		group.map((c) => ({
			capability: c.capability,
			tier,
			targets: c.targets.length,
			admitted: admittedNames.has(c.capability)
		}));

	return {
		entries: [
			...entriesFor(parts.subject, 'subject'),
			...parts.children.flatMap((g) => entriesFor(g, 'child')),
			...parts.matched.flatMap((g) => entriesFor(g, 'matched'))
		],
		chars: parts.chars,
		budgetChars: parts.budgetChars
	};
}

/** Capabilities that were resolved for this turn and then did not fit. */
export function droppedForBudget(record: CapabilityRecord | null | undefined): CapabilityEntry[] {
	return (record?.entries ?? []).filter((e) => !e.admitted);
}
