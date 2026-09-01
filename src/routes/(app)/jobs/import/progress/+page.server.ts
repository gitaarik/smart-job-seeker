import type { PageServerLoad } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { match_config } from '$lib/server/db/schema';
import { getSkillVocabularyReach } from '$lib/server/job/match-counts';

/**
 * Skill reach is loaded here rather than on /api/matcher/status, which the page
 * polls every 3 seconds.
 *
 * It costs ~110ms on preview's corpus: a full scan over `jobs` expanding two
 * jsonb arrays per row, plus the ontology traversal in getExpandedProfileSkills.
 * On the poll that is a permanent ~4% of a core per open tab, against the same
 * database the matcher and the scrapers are already using, for a number that
 * moves when someone edits their skills or imports a batch of jobs. Once per
 * page load is the right cadence for it, and a stale reading between navigations
 * is not a way to be wrong about this.
 *
 * Never fails the page: the reach banner is advice, and a page that 500s because
 * its advice could not be computed is a worse outcome than one without it.
 */
export const load: PageServerLoad = async ({ parent }) => {
	const { profileId } = await parent();

	try {
		const config = await db.query.match_config.findFirst({
			where: eq(match_config.profile_id, profileId),
			columns: { match_community_jobs: true, community_max_age_days: true }
		});

		return {
			skillReach: await getSkillVocabularyReach(
				profileId,
				config?.match_community_jobs ?? false,
				config?.community_max_age_days ?? null
			)
		};
	} catch (err) {
		console.warn('[progress] skill reach unavailable:', err);
		return { skillReach: null };
	}
};
