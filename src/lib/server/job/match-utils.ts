/**
 * Utility functions for job matching - profile skill extraction
 */

import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { tech_skills, tech_skill_categories } from '$lib/server/db/schema';
import { normalizeSkill } from '$lib/skills';
import type { AdjacentSkill, SkillProvenance } from '$lib/match-provenance';
import { approvedAliasesOf, expandUpward, expandUpwardBySeed, relatedTo } from './skill-ontology';

/**
 * Extract tech skills from a profile
 * @param profileId - Profile ID to extract skills from
 * @returns Array of skill names
 */
export async function getProfileSkills(profileId: number): Promise<string[]> {
	const rows = await db
		.select({ name: tech_skills.name })
		.from(tech_skills)
		.innerJoin(tech_skill_categories, eq(tech_skills.category_id, tech_skill_categories.id))
		.where(eq(tech_skill_categories.profile_id, profileId));

	return rows.map((s) => s.name).filter((name): name is string => !!name);
}

/**
 * Profile skills augmented from the ontology, so the exact-match gates
 * downstream benefit without knowing it exists.
 *
 * The ontology adds what is *implied*, upward only, over curated directional
 * edges: "React" reaches "JavaScript" and JavaScript does not reach back.
 *
 * ## Why embeddings are no longer in this union
 *
 * They used to be, and the reasoning was sound while it held: cosine adds what
 * is semantically near for free, and when it was the only source of recall it
 * was worth its false positives. It is symmetric — one number for an unordered
 * pair — so it cannot tell "React implies JavaScript" from "JavaScript implies
 * React", and admits both.
 *
 * Re-measured on the 62 labelled pairs (`scripts/eval-skill-matching.ts`, run
 * 2026-08-27) once the graph had grown, the union no longer paid for that:
 *
 *   exact           100.0% precision / 10.7% recall
 *   +embeddings      76.9%            / 35.7%
 *   +ontology        90.0%            / 96.4%   ← this union
 *   ontology only   100.0%            / 96.4%   ← this function now
 *
 * Recall is identical either way. Every true positive embeddings found, the
 * graph found too — their 7 were a strict subset of its 27 — so the layer was
 * buying nothing and costing three false positives, all of them the symmetric
 * mistake: `Jest → Vitest` (siblings), `Jest → Vitest / Jest` and
 * `Scrum → Agile/Scrum` (a part does not claim the whole entry).
 *
 * The earlier note here proposed re-tuning `embeddingSkillThreshold` upward
 * instead. That was the right follow-up when the layer still supplied recall;
 * no threshold saves a layer whose every hit is already covered.
 *
 * This is a measurement on one small set, and the set was written to exercise
 * the ontology. If paraphrase pairs the graph genuinely cannot walk are ever
 * added — "Modern Frontend Framework", "Backend programming and scripting" —
 * re-run the eval before assuming this still holds. `expandProfileSkills` is
 * untouched and still scored as `+embeddings`, so putting it back is one line.
 *
 * `base` is spread explicitly because `expandUpward` returns only concepts that
 * EXIST in the graph. Coverage is 36% of skill mentions, so dropping the raw
 * skills here would silently discard most of a profile — the union used to
 * carry them by accident, via `expandProfileSkills` seeding its set with them.
 *
 * Degrades cleanly: an empty ontology contributes nothing, and a traversal
 * failure is not allowed to fail the call.
 */
export async function getExpandedProfileSkills(profileId: number): Promise<string[]> {
	const base = await getProfileSkills(profileId);
	if (base.length === 0) return base;

	// Never let a traversal failure cost the caller its exact skills — matching
	// on fewer skills silently returns fewer jobs, which reads as "nothing
	// matched" rather than as a fault.
	const viaOntology = await expandUpward(base).catch((err) => {
		console.warn('[match-utils] ontology expansion failed, continuing without it:', err);
		return [];
	});

	// Approved alias SPELLINGS of everything reached, so a posting's wording
	// resolves as well as a profile's does. Without them the alias table only
	// worked in one direction — see `approvedAliasesOf`. This is the one place
	// the fix belongs: every gate that filters on skills goes through here, so
	// putting it anywhere narrower would make eligibility and scoring disagree.
	const aliases = await approvedAliasesOf(viaOntology.map((c) => c.slug)).catch((err) => {
		console.warn('[match-utils] alias spellings unavailable, job wordings may miss:', err);
		return [];
	});

	return [
		...new Set([...base, ...viaOntology.map((c) => c.label), ...aliases.map((a) => a.alias)])
	];
}

/**
 * Extract tech skills from a profile with proficiency info.
 * Returns a map of lowercase skill name -> proficiency level.
 * "strong" = expert/proficient or 3+ years
 * "weak" = beginner/intermediate or <3 years (when level is set)
 */
export async function getProfileSkillLevels(
	profileId: number
): Promise<Record<string, 'strong' | 'weak'>> {
	const rows = await db
		.select({
			name: tech_skills.name,
			level: tech_skills.level,
			years_experience: tech_skills.years_experience
		})
		.from(tech_skills)
		.innerJoin(tech_skill_categories, eq(tech_skills.category_id, tech_skill_categories.id))
		.where(eq(tech_skill_categories.profile_id, profileId));

	const result: Record<string, 'strong' | 'weak'> = {};
	for (const skill of rows) {
		if (!skill.name) continue;
		const key = skill.name.toLowerCase();

		// Determine proficiency
		const level = skill.level?.toLowerCase();
		const years = skill.years_experience;

		if (level === 'beginner' || level === 'intermediate') {
			result[key] = 'weak';
		} else if (level === 'expert' || level === 'proficient') {
			result[key] = 'strong';
		} else if (years !== null && years !== undefined && years < 3) {
			// No level set but few years of experience
			result[key] = 'weak';
		} else {
			// No level set, no years or 3+ years — assume strong
			result[key] = 'strong';
		}
	}
	return result;
}

/**
 * Everything one profile's skills can answer, and which skill answers it.
 *
 * Depends on the PROFILE only, never the job, so it is computed once and reused
 * across every job in a run. That is not an optimisation, it is the difference
 * between one query and thousands: `skill-embeddings.ts` carries an LRU memo for
 * exactly this shape of mistake, made once already.
 *
 * `expanded` is byte-for-byte what `getExpandedProfileSkills` returns — the same
 * walk, since `expandUpwardBySeed` is `expandUpward` keyed by seed — so a caller
 * that needs both the flat list and the attribution pays for one query, not two.
 */
export interface ProfileReach {
	/** Normalized profile skill -> the spelling the applicant actually wrote. */
	spelling: Map<string, string>;
	/** Concept the profile reaches -> the closest skill that reached it. */
	byReached: Map<string, { seed: string; depth: number }>;
	/** The flat expanded skill list, for the exact-match gates downstream. */
	expanded: string[];
	/**
	 * Concept the profile is one `related` hop from -> the skill that is related.
	 *
	 * Strictly separate from `byReached`. Nothing in here is a match, and no
	 * caller may fold it into one — see `relatedTo`.
	 */
	adjacent: Map<string, { seed: string }>;
}

/**
 * Build a profile's reach. Hoist the call above any per-job loop.
 *
 * Degrades exactly as `getExpandedProfileSkills` does: a traversal failure costs
 * the attribution, never the skills. Matching on fewer skills silently returns
 * fewer jobs, which reads as "nothing matched" rather than as a fault.
 */
export async function profileReach(profileId: number): Promise<ProfileReach> {
	const base = await getProfileSkills(profileId);

	// First spelling wins. Two rows that normalize the same way are the same
	// skill, and either spelling answers a job equally well, so the tie is not
	// worth a decision — but it must be a STABLE tie, not row order dressed up as
	// one, which is why it is written down rather than left to `new Map`.
	const spelling = new Map<string, string>();
	for (const s of base) {
		const key = normalizeSkill(s);
		if (key && !spelling.has(key)) spelling.set(key, s);
	}
	if (base.length === 0)
		return { spelling, byReached: new Map(), expanded: base, adjacent: new Map() };

	const reach = await expandUpwardBySeed(base).catch((err) => {
		console.warn('[match-utils] ontology expansion failed, continuing without it:', err);
		return new Map<string, { slug: string; label: string; depth: number }[]>();
	});

	// Invert to reached-concept -> the CLOSEST seed that reached it. Closest,
	// because a job's "JavaScript" answered by both React (depth 2) and
	// TypeScript (depth 1) should credit the one making the shorter claim — and
	// because the alternative, first-seen, makes the answer depend on the order
	// `getProfileSkills` happened to return rows in.
	const byReached = new Map<string, { seed: string; depth: number }>();
	const labels: string[] = [];
	for (const [seed, reached] of reach) {
		for (const r of reached) {
			labels.push(r.label);
			const prev = byReached.get(r.slug);
			if (!prev || r.depth < prev.depth) byReached.set(r.slug, { seed, depth: r.depth });
		}
	}

	// Approved alias spellings, registered BOTH as attribution keys and into
	// `expanded`, because `getExpandedProfileSkills` now emits them too and the
	// two must not disagree about what counts as matched.
	const aliasRows =
		byReached.size > 0
			? await approvedAliasesOf([...byReached.keys()]).catch((err) => {
					console.warn(
						'[match-utils] alias spellings unavailable, attribution may over-report llm:',
						err
					);
					return [];
				})
			: [];
	for (const a of aliasRows) {
		const hit = byReached.get(a.slug);
		// Never shadow a concept that is itself reachable: if both readings exist,
		// the one that is a real node wins.
		if (hit && !byReached.has(a.alias)) byReached.set(a.alias, hit);
		if (a.alias) labels.push(a.alias);
	}

	// `base` is spread explicitly for the same reason `getExpandedProfileSkills`
	// does it: the walk returns only concepts that EXIST in the graph, and
	// coverage is well short of the whole vocabulary, so dropping the raw skills
	// here would silently discard most of a profile.
	// Gap analysis only. Kept out of `expanded` and out of `byReached` by
	// construction: a symmetric edge that reached either would be a match, which
	// is the one thing `related` must never be.
	const adjacent = new Map<string, { seed: string }>();
	const relatedRows = await relatedTo(base).catch((err) => {
		console.warn('[match-utils] related hop unavailable, gaps stay unannotated:', err);
		return [];
	});
	for (const r of relatedRows) {
		if (!adjacent.has(r.slug)) adjacent.set(r.slug, { seed: r.seed });
	}

	return { spelling, byReached, expanded: [...new Set([...base, ...labels])], adjacent };
}

/**
 * Attribute each of a job's skills to how the profile answers it. Pure, so it
 * runs per job at no query cost once `profileReach` is in hand.
 *
 * A skill the profile cannot reach is ABSENT rather than present-and-unmatched:
 * the caller merges in whatever the LLM pass claimed afterwards, and anything
 * still unattributed at that point is by definition `llm`.
 */
export function attributeSkills(
	reach: ProfileReach,
	jobSkills: string[]
): Map<string, SkillProvenance> {
	const out = new Map<string, SkillProvenance>();
	for (const skill of jobSkills) {
		const key = normalizeSkill(skill);
		if (!key || out.has(skill)) continue;
		if (reach.spelling.has(key)) {
			out.set(skill, { skill, via: 'literal', depth: 0 });
			continue;
		}
		const hit = reach.byReached.get(key);
		if (!hit) continue;
		out.set(skill, {
			skill,
			via: hit.depth === 0 ? 'alias' : 'ontology',
			depth: hit.depth,
			from: reach.spelling.get(hit.seed) ?? hit.seed
		});
	}
	return out;
}

export type { MatchVia, SkillProvenance } from '$lib/match-provenance';

/**
 * For each job skill the profile does NOT answer, a related skill it does hold.
 *
 * Pure, so it runs per job for free. Takes the matched set explicitly rather
 * than deriving it, because "unmatched" must mean what the matcher concluded —
 * including the LLM pass — and not what attribution alone could see.
 */
export function adjacentSkills(
	reach: ProfileReach,
	jobSkills: string[],
	matched: Set<string>
): AdjacentSkill[] {
	const out: AdjacentSkill[] = [];
	const seen = new Set<string>();
	for (const skill of jobSkills) {
		if (matched.has(skill) || seen.has(skill)) continue;
		const key = normalizeSkill(skill);
		if (!key) continue;
		const hit = reach.adjacent.get(key);
		if (!hit) continue;
		seen.add(skill);
		out.push({ skill, from: reach.spelling.get(hit.seed) ?? hit.seed });
	}
	return out;
}

export type { AdjacentSkill } from '$lib/match-provenance';
