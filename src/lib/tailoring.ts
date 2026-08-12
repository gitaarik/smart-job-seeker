/**
 * Choosing what a job-tailored resume shows — the deterministic half.
 *
 * A tailored version is a SELECTION over the profile the applicant already
 * wrote, never new prose: it decides which bullets, projects and skills print
 * for one job. That constraint is the point. A selection cannot invent
 * experience, it can be reviewed at a glance, and every decision can be
 * explained by the data that produced it.
 *
 * Three of the four layers in planning/TAILORED-VERSIONS.md live here, because
 * they are pure and therefore testable:
 *
 *   L0  hard rules — what must show, and what may never be dropped
 *   L2  fit to the page — length is the scarce resource
 *   ordering — lead with the bullet this job cares about
 *
 * L1 (semantic relevance) arrives as a score per candidate, and L3 (the model)
 * only ever re-decides what this file short-listed; both live server-side.
 *
 * The rule that shapes the whole thing: only ACHIEVEMENTS and SIDE PROJECTS can
 * be dropped. Roles and education are not droppable — omitting a job
 * misrepresents a history rather than focusing it, and that is the line between
 * a tailored resume and a dishonest one. Enforcing it by leaving them out of
 * the droppable set is stronger than checking for it afterwards. Skills are
 * likewise never dropped here: a single skill name is thin evidence to rank on,
 * and the downside of quietly removing one outweighs the tidiness.
 */

import { OVERRIDE_ENTITIES, type OverrideAction } from '$lib/version-overrides';

/** Entities a selection may drop. Everything else can only be added. */
export const DROPPABLE_ENTITIES: string[] = [
	OVERRIDE_ENTITIES.achievement,
	OVERRIDE_ENTITIES.sideProject
];

export interface Candidate {
	/** An $lib/version-overrides entity type. */
	entityType: string;
	entityId: number;
	/** What it belongs to — a bullet's role, a skill's category. Null if free-standing. */
	parentId: number | null;
	/** Human label, shown in the review diff. */
	label: string;
	/** Rough printed length, the currency L2 spends. */
	chars: number;
	/** Whether the version this one is built on already prints it. */
	visible: boolean;
	/**
	 * Must appear: a skill this job requires that the applicant has. Pinned
	 * candidates are included whatever their relevance score says.
	 */
	pinned: boolean;
	/** L1 relevance to this job. Comparable within one run, not across runs. */
	score: number;
	/**
	 * Where a pinned candidate should land among its siblings, when appending it
	 * would read wrong: a skill surfaced for this job belongs beside the ones it
	 * relates to, not tacked onto the end of the category. An index in the list
	 * the document already shows — see orderByOverrides. Null appends.
	 */
	anchor?: number | null;
}

export interface Decision {
	entityType: string;
	entityId: number;
	action: OverrideAction;
	/** Per-version order; null leaves the item's own global sort alone. */
	sort: number | null;
	/** Why — carried into the sidecar and shown to the applicant. */
	reason: string;
}

export interface SelectionOptions {
	/**
	 * Relevance below which a droppable candidate is a candidate for dropping.
	 * Scale depends on the ranker (cosine vs lexical overlap), so the caller —
	 * which knows which ran — supplies it.
	 */
	floor: number;
	/** Bullets a role keeps no matter what. A role with none reads as padding. */
	minPerParent: number;
	/** Rough character budget for the printed document. */
	budgetChars: number;
	/** Name of the skill or theme that pinned a candidate, for the reason line. */
	pinnedReason?: (candidate: Candidate) => string;
}

export const DEFAULT_SELECTION: Pick<SelectionOptions, 'minPerParent' | 'budgetChars'> = {
	minPerParent: 2,
	// A one-page resume is roughly this much printed text in the default
	// template. It is a proxy, not a measurement — the honest version would
	// render and measure, which needs a browser and is not worth it to decide
	// which bullet is fourth.
	budgetChars: 3400
};

/** How many items may be promoted within one group. Two lines, not twenty. */
const MAX_PROMOTED = 2;

function isDroppable(candidate: Candidate): boolean {
	return DROPPABLE_ENTITIES.includes(candidate.entityType);
}

/**
 * Decide what this job's version shows, as a list of changes against what the
 * base version already prints.
 *
 * Only differences are returned: an item the base version shows and this one
 * keeps produces no row, so the sidecar stays a diff rather than a copy of the
 * profile. Ordering rows are emitted only when the relevance order actually
 * differs from the order the applicant already has.
 */
export function selectForJob(candidates: Candidate[], options: SelectionOptions): Decision[] {
	const { floor, minPerParent, budgetChars } = options;
	const decisions: Decision[] = [];

	// ── L0: what must show ──
	for (const candidate of candidates) {
		if (!candidate.pinned || candidate.visible) continue;
		decisions.push({
			entityType: candidate.entityType,
			entityId: candidate.entityId,
			action: 'include',
			sort: candidate.anchor ?? null,
			reason: options.pinnedReason?.(candidate) ?? 'required by this job'
		});
	}

	// Everything the document would print once L0 has had its say.
	const kept = candidates.filter((c) => c.visible || c.pinned);
	const droppable = kept.filter(isDroppable);

	// How many droppable siblings each parent has, so a role cannot be emptied.
	const keptPerParent = new Map<number | null, number>();
	for (const candidate of droppable) {
		keptPerParent.set(candidate.parentId, (keptPerParent.get(candidate.parentId) ?? 0) + 1);
	}

	const dropped = new Set<number>();
	const dropKey = (c: Candidate) => c.entityId;

	function canDrop(candidate: Candidate): boolean {
		if (candidate.pinned) return false;
		const siblings = keptPerParent.get(candidate.parentId) ?? 0;
		// A free-standing group (side projects share a null parent) keeps one, so
		// the section does not silently disappear; a role keeps minPerParent.
		const floorForParent = candidate.parentId === null ? 1 : minPerParent;
		return siblings > floorForParent;
	}

	function drop(candidate: Candidate, reason: string) {
		dropped.add(dropKey(candidate));
		keptPerParent.set(candidate.parentId, (keptPerParent.get(candidate.parentId) ?? 1) - 1);
		// An item the base version doesn't print needs no exclusion row — it is
		// already absent, and a row saying so would be noise in the diff.
		if (!candidate.visible) return;
		decisions.push({
			entityType: candidate.entityType,
			entityId: candidate.entityId,
			action: 'exclude',
			sort: null,
			reason
		});
	}

	// ── L1 verdict: below the relevance floor ──
	const byScore = [...droppable].sort((a, z) => a.score - z.score);
	for (const candidate of byScore) {
		if (candidate.score >= floor || !canDrop(candidate)) continue;
		drop(candidate, `not relevant to this job (${candidate.score.toFixed(2)})`);
	}

	// ── L2: fit to the page ──
	const printedChars = () =>
		kept.filter((c) => !dropped.has(dropKey(c))).reduce((sum, c) => sum + c.chars, 0);
	for (const candidate of byScore) {
		if (printedChars() <= budgetChars) break;
		if (dropped.has(dropKey(candidate)) || !canDrop(candidate)) continue;
		drop(candidate, 'trimmed to keep the document to length');
	}

	// ── Ordering: lead with what this job cares about ──
	//
	// PROMOTION, not re-sorting. Ranking every bullet of a role by relevance
	// overrides an order the applicant chose deliberately, on score differences
	// that are often noise — and it writes a row per bullet, turning a reviewable
	// diff into a wall. Moving the one or two that genuinely speak to this job to
	// the front says the same thing in two rows, and the rest keep their order
	// for free: orderByOverrides leaves items without a sort behind the ones that
	// have it, in their original sequence.
	const survivors = kept.filter((c) => isDroppable(c) && !dropped.has(dropKey(c)));
	const byParent = new Map<number | null, Candidate[]>();
	for (const candidate of survivors) {
		const list = byParent.get(candidate.parentId) ?? [];
		list.push(candidate);
		byParent.set(candidate.parentId, list);
	}
	for (const [, siblings] of byParent) {
		if (siblings.length < 2) continue;
		// Only genuinely relevant items are worth promoting; below the floor the
		// ordering would be reshuffling on noise.
		const leaders = [...siblings]
			.sort((a, z) => z.score - a.score)
			.slice(0, MAX_PROMOTED)
			.filter((c) => c.score >= floor);
		if (leaders.length === 0) continue;
		if (leaders.every((c, i) => siblings[i]?.entityId === c.entityId)) continue;

		leaders.forEach((candidate, index) => {
			const existing = decisions.find(
				(d) => d.entityType === candidate.entityType && d.entityId === candidate.entityId
			);
			if (existing) {
				existing.sort = index;
				return;
			}
			decisions.push({
				entityType: candidate.entityType,
				entityId: candidate.entityId,
				action: 'include',
				sort: index,
				reason:
					index === 0
						? 'the most relevant thing you have for this job — moved to the top'
						: 'also speaks to this job — moved up'
			});
		});
	}

	return decisions;
}
