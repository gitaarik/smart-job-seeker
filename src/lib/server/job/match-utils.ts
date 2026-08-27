/**
 * Utility functions for job matching - profile skill extraction
 */

import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { tech_skills, tech_skill_categories } from '$lib/server/db/schema';
import { expandUpward } from './skill-ontology';

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
 * 2026-08-26) once the graph had grown, the union no longer paid for that:
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

	return [...new Set([...base, ...viaOntology.map((c) => c.label)])];
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
