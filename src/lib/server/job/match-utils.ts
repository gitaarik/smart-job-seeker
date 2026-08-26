/**
 * Utility functions for job matching - profile skill extraction
 */

import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { tech_skills, tech_skill_categories } from '$lib/server/db/schema';
import { expandProfileSkills } from './skill-embeddings';
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
 * Profile skills augmented from two independent sources, so the exact-match
 * gates downstream benefit without knowing either exists.
 *
 * **Embeddings** add what is semantically near — "React" pulls in "frontend".
 * Cheap, needs no curation, and symmetric: cosine returns one number for an
 * unordered pair, so it cannot tell "React implies JavaScript" from
 * "JavaScript implies React" and admits both.
 *
 * **The ontology** adds what is *implied*, upward only, over curated
 * directional edges. It cannot make the symmetric mistake — there is no edge
 * pointing back down to follow.
 *
 * Measured on 40 labelled pairs (planning/SKILL-ONTOLOGY.md § Result), the
 * union scores precision 80.0% / recall 70.6% against 70.0% / 41.2% for
 * embeddings alone: better on both axes, with false negatives halved and no new
 * false positives.
 *
 * ⚠️ One number here is now stale by construction. `embeddingSkillThreshold`
 * (0.68) was tuned when expansion was the ONLY source of recall; it no longer
 * is, and the same measurement shows the ontology alone reaching **90.9%**
 * precision because it drops two false positives that come entirely from the
 * embedding side. Re-tuning that threshold upward is the open follow-up, and
 * this is the function whose behaviour it governs.
 *
 * Degrades cleanly: embeddings unconfigured returns the input unchanged, an
 * empty ontology contributes nothing, and neither is allowed to fail the call.
 */
export async function getExpandedProfileSkills(profileId: number): Promise<string[]> {
	const base = await getProfileSkills(profileId);
	if (base.length === 0) return base;

	const [viaEmbeddings, viaOntology] = await Promise.all([
		expandProfileSkills(base),
		// Never let a traversal failure cost the caller its exact skills —
		// matching on fewer skills silently returns fewer jobs, which reads as
		// "nothing matched" rather than as a fault.
		expandUpward(base).catch((err) => {
			console.warn('[match-utils] ontology expansion failed, continuing without it:', err);
			return [];
		})
	]);

	return [...new Set([...viaEmbeddings, ...viaOntology.map((c) => c.label)])];
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
