/**
 * Whether a profile is too thin for its match scores to mean much yet.
 *
 * A match score answers "how well does this profile show you fit the job",
 * and a profile with no roles has nothing to show it with. The corpus
 * picks made that visible on day one (sjs-ops planning/CORPUS-MATCHING.md,
 * Phase 2 dogfood): a title and five skills got 50 jobs that were right for
 * them by hand, scored median 32 with none at 70, while the same jobs average
 * 75 for a full profile. The scores were honest; showing them in red as the
 * verdict was not. Pages use this to show a thin profile's scores as early
 * ones and to point at the CV import, never to change a score.
 *
 * Roles rather than a skill count: a skill count is the wrong predictor of a
 * thin profile (a nine-skill software profile reaches most of the corpus), and
 * the matcher's evidence is the work history. Rescaling the score for thin
 * profiles was considered and turned down: scores would then fall as the
 * profile filled, and a measured reweighting of the skill share for them
 * (2026-09-01) changed nothing, because the gap is recall.
 */
import { count, eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { work_experiences } from '$lib/server/db/schema';

export async function isThinProfile(profileId: number): Promise<boolean> {
	const [row] = await db
		.select({ n: count() })
		.from(work_experiences)
		.where(eq(work_experiences.profile_id, profileId));
	return (row?.n ?? 0) === 0;
}
