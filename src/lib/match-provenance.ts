/**
 * How a job's skill came to count as matched.
 *
 * Lives outside `$lib/server` because both sides need it: the matcher writes it
 * and `SkillPill` renders it, and SvelteKit refuses a client import of anything
 * under `$lib/server` — a type-only import would be erased, but relying on that
 * makes the module boundary depend on a compiler detail rather than on where the
 * file sits.
 *
 * `literal`  — the applicant's own skill string, normalized, IS the job's.
 * `alias`    — the same concept spelled differently ("Vue.js" / "Vue"). Depth 0:
 *              an alias is not a hop, it is the same node reached by another name.
 * `ontology` — a real implication, `depth` hops upward ("MySQL" answers "SQL").
 * `llm`      — none of the above; the fallback pass in `calculateMatch` claimed
 *              it. Kept as its own value rather than folded into the others
 *              because it is the least trustworthy of the four and, until this
 *              type existed, was indistinguishable from the most trustworthy.
 */
export type MatchVia = 'literal' | 'alias' | 'ontology' | 'llm';

export interface SkillProvenance {
	/** The job's skill string, spelled as the posting wrote it. */
	skill: string;
	via: MatchVia;
	/** Hops through the graph. 0 for literal and alias, >= 1 for ontology. */
	depth: number;
	/** The applicant's own skill that reached it — the "because you have X". */
	from?: string;
}

/**
 * Why this skill counted, in the applicant's own terms — or null when saying so
 * would be noise.
 *
 * Null for `literal`, on purpose: "matched because you have it" tells nobody
 * anything, and a tooltip on every pill trains people to ignore all of them.
 * Null with no `from` for the same reason — an explanation that cannot name the
 * skill it came from is not an explanation.
 */
export function matchExplanation(via: MatchVia | null, from: string | null): string | null {
	if (via === 'ontology' && from) return `Matched because you have ${from}`;
	if (via === 'alias' && from) return `You have this as "${from}"`;
	if (via === 'llm') return 'Inferred from your profile, not an exact skill match';
	return null;
}

/**
 * Read one skill's provenance out of a `job_matches.matched_skill_details` blob.
 *
 * Every caller reaches this through an unvalidated `json` column that is null on
 * every row scored before the column existed, so the narrowing lives here once
 * rather than in each of the four render sites.
 */
export function provenanceFor(
	details: unknown,
	skill: string
): { via: MatchVia; from: string | null } | null {
	if (!Array.isArray(details)) return null;
	const hit = details.find(
		(d): d is SkillProvenance =>
			!!d && typeof d === 'object' && (d as SkillProvenance).skill === skill
	);
	return hit ? { via: hit.via, from: hit.from ?? null } : null;
}

/**
 * A gap worth talking about: the job asked for something the applicant does not
 * have, but the profile holds a skill one `related` hop away.
 *
 * Deliberately NOT a `MatchVia`. `SkillProvenance` hangs off `matched_skills`,
 * so anything stored there reads as matched — and Docker does not mean
 * Kubernetes. This is the opposite field: it annotates a gap, and the pill it
 * decorates stays a gap.
 */
export interface AdjacentSkill {
	/** The job's skill string, spelled as the posting wrote it. */
	skill: string;
	/** The applicant's own skill that is related to it. */
	from: string;
}

/** Read one skill's adjacency out of `job_matches.adjacent_skills`. */
export function adjacentFor(adjacent: unknown, skill: string): string | null {
	if (!Array.isArray(adjacent)) return null;
	const hit = adjacent.find(
		(a): a is AdjacentSkill => !!a && typeof a === 'object' && (a as AdjacentSkill).skill === skill
	);
	return hit?.from ?? null;
}

/**
 * Why a gap is smaller than it looks, in the applicant's own terms.
 *
 * Worded to stop short of a claim: "related to" is true, "you basically have it"
 * is not, and the difference is the whole reason `related` is kept off the match
 * path.
 */
export function adjacencyExplanation(from: string | null): string | null {
	return from ? `You don't have this, but you have ${from}, which is related` : null;
}
