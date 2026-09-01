/**
 * Shared match counting queries.
 *
 * SINGLE SOURCE OF TRUTH for job match statistics.
 * Used by the matcher status API and the match progress page.
 * Uses the same visibility scope (match_community_jobs) as the matcher itself.
 */

import { queryRaw, sql, sqlJoin } from '$lib/server/db';
import { buildEligibilityFilter } from '$lib/server/job/eligibility';
import { getExpandedProfileSkills } from '$lib/server/job/match-utils';
import { normalizeSkill } from '$lib/skills';

export interface MatchCounts {
	totalJobs: number;
	matchedCount: number; // score > 0 (LLM evaluated, any positive score)
	noMatchCount: number; // score = 0 with a job_matches row (not recommended + ineligible)
	notRecommendedCount: number; // subset of noMatch: LLM said not recommended
	ineligibleCount: number; // subset of noMatch: failed eligibility filter
	unmatchedCount: number; // no job_matches row yet
}

/**
 * How much of the job corpus this profile's skill vocabulary can even reach.
 *
 * Not a quality measure and not a match rate. It answers one narrow question:
 * on how many postings does at least one of the applicant's listed skills
 * appear as a literal string? That is the input the deterministic half of
 * matching runs on, and when it is near zero, every deterministic step
 * downstream is running on nothing.
 *
 * ## Why this is worth showing someone
 *
 * Measured across preview's profiles on 2026-09-01, over the same expanded
 * skill list this function uses, it does not vary smoothly. It clusters:
 *
 *   profile 1   103 skills   reach 76%
 *   profile 55   59 skills   reach 73%
 *   profile 12   32 skills   reach 67%
 *   profile 48   11 skills   reach 67%
 *   profile 45   13 skills   reach  9%
 *   profile 58   11 skills   reach  7%
 *   profile 50    8 skills   reach  1%
 *   profile 52    7 skills   reach  0%
 *
 * Nothing lands between 67% and 9%. Note profile 48: eleven skills and a reach
 * of 67%, against profile 45's thirteen and 9%. So this is NOT a proxy for how
 * many skills someone listed, and a threshold on skill COUNT would have called
 * 48 thin and been wrong — 48's eleven are software terms and the corpus is
 * full of them. What it measures is whether the applicant's vocabulary and the
 * corpus's vocabulary are the same vocabulary.
 *
 * Measure it over `getProfileSkills` alone and profile 58 reads 2% rather than
 * 7%; her three working languages are most of what she can currently reach. The
 * expanded list is the right input because it is the one the gate runs on, but
 * the gap between the two numbers is worth remembering before reading 7% as
 * "some skills are landing".
 *
 * At 2% the exact-string gate is not filtering, it is blocking: profile 52 at
 * 0% can never receive a single community match, and nothing in the product
 * says so. Profile 58's rejections read "No skill overlap" one job at a time,
 * which invites the reading that those jobs were wrong, rather than that the
 * test is inapplicable to her whole field.
 *
 * ## The scope is the point, and it is counter-intuitive
 *
 * Those figures are the COMMUNITY pool. Measured instead in each profile's real
 * scope — honouring match_community_jobs, as this function does — profile 58
 * reads 58%, not 7%: 143 of the 245 jobs she imported herself name a skill she
 * lists. Her vocabulary is fine against the postings she actually matches
 * against, because she chose them. It collapses only against the community pool,
 * which is mostly software.
 *
 * So this deliberately stays silent for her, and that is the correct answer
 * rather than a miss. Telling someone "your skills reach 7% of postings" while
 * 58% of the postings they are actually matched against are reachable would
 * send them off to pad their skill list for no gain, and their real problem
 * (work-location, job-type and experience preferences narrower than their
 * field) would go unmentioned. It starts warning her the moment she turns
 * community matching on, which is exactly when the 7% becomes a fact about her
 * results.
 *
 * On preview it fires for three profiles, all with community matching on and
 * near-zero reach — including profile 52, which cannot receive a single
 * community match and is told nothing today.
 *
 * ## What it deliberately does not do
 *
 * It does not feed the matcher. Standing the gate down for a low-reach profile
 * was the obvious next move and it is a trap: profile 58's eligible pool goes
 * from ~95 to ~3,864 jobs, and since the matcher is bounded by credits rather
 * than by this gate, the effect is not "more matches" but "the same credits
 * spent on 40x more postings averaging a score of 30". The gate is doing
 * prioritisation while presenting as a filter, and removing it without
 * replacing the ranking makes the outcome worse. So this number is reported
 * and acted on by a person, not consumed by the loop it describes.
 */
export interface SkillVocabularyReach {
	/** Jobs in scope carrying any skill data at all — the denominator. */
	jobsWithSkills: number;
	/** Of those, how many name at least one skill this profile lists. */
	reachedJobs: number;
	/** reachedJobs / jobsWithSkills as 0-100, or null when nothing to measure. */
	percentage: number | null;
	/** Distinct normalized skills the profile brings, after ontology expansion. */
	profileSkillCount: number;
}

/**
 * Build FROM + WHERE fragments scoped by match_community_jobs setting.
 * When match_community_jobs is off, only jobs imported by this profile are visible.
 * When community_max_age_days is set, community jobs older than that are excluded
 * (own-imported jobs are always included regardless of age).
 */
export function buildVisibilityScope(
	profileId: number,
	matchCommunityJobs: boolean,
	communityMaxAgeDays?: number | null
) {
	const ownershipFilter = matchCommunityJobs ? sql`` : sql`AND ji.id IS NOT NULL`;

	// When community matching is on with an age limit, with:
	// - all own-imported jobs (ji.id IS NOT NULL), regardless of age
	// - community jobs only if created within the age window
	const ageFilter =
		matchCommunityJobs && communityMaxAgeDays
			? sql`AND (ji.id IS NOT NULL OR j.date_created >= NOW() - MAKE_INTERVAL(days => ${communityMaxAgeDays}))`
			: sql``;

	return {
		from: sql`
      FROM jobs j
      LEFT JOIN job_importers ji ON j.id = ji.job_id AND ji.profile_id = ${profileId}`,
		where: sql`
      WHERE j.status != 'archived'
      ${ownershipFilter}
      ${ageFilter}`
	};
}

/**
 * Get all match counts in a single query using the shared visibility scope.
 * Returns totals for matched, not recommended, ineligible, and unmatched jobs.
 */
export async function getMatchCounts(
	profileId: number,
	matchCommunityJobs: boolean,
	communityMaxAgeDays?: number | null
): Promise<MatchCounts> {
	const { from, where } = buildVisibilityScope(profileId, matchCommunityJobs, communityMaxAgeDays);

	const result = await queryRaw<{
		total: number;
		matched: number;
		no_match: number;
		not_recommended: number;
		ineligible: number;
		unmatched: number;
	}>(sql`
    SELECT
      COUNT(DISTINCT j.id)::int AS total,
      COUNT(DISTINCT j.id) FILTER (WHERE jm.score > 0)::int AS matched,
      COUNT(DISTINCT j.id) FILTER (WHERE jm.id IS NOT NULL AND jm.score = 0)::int AS no_match,
      COUNT(DISTINCT j.id) FILTER (WHERE jm.recommendation = 'not_recommended')::int AS not_recommended,
      COUNT(DISTINCT j.id) FILTER (WHERE jm.recommendation = 'ineligible')::int AS ineligible,
      COUNT(DISTINCT j.id) FILTER (WHERE jm.id IS NULL)::int AS unmatched
    ${from}
    LEFT JOIN job_matches jm ON j.id = jm.job_id AND jm.profile_id = ${profileId}
    ${where}
  `);

	const row = result[0];
	return {
		totalJobs: row.total,
		matchedCount: row.matched,
		noMatchCount: row.no_match,
		notRecommendedCount: row.not_recommended,
		ineligibleCount: row.ineligible,
		unmatchedCount: row.unmatched
	};
}

/**
 * Count unmatched jobs that pass the eligibility filter.
 * These are jobs the matcher will send to the LLM for scoring.
 * Returns 0 if match config is incomplete (no work locations, job types, or skills).
 */
export async function getEligibleUnmatchedCount(
	profileId: number,
	matchCommunityJobs: boolean,
	matchConfig: {
		work_location: unknown;
		job_types: unknown;
		experience_levels?: unknown;
		community_max_age_days?: number | null;
	} | null
): Promise<number> {
	const workLocations = matchConfig?.work_location as string[] | null;
	const jobTypes = matchConfig?.job_types as string[] | null;
	const experienceLevels = matchConfig?.experience_levels as string[] | null;
	const profileSkills = await getExpandedProfileSkills(profileId);

	if (!workLocations?.length || !jobTypes?.length || profileSkills.length === 0) {
		return 0;
	}

	const { from, where } = buildVisibilityScope(
		profileId,
		matchCommunityJobs,
		matchConfig?.community_max_age_days
	);
	// profileId so the count exempts the applicant's own imports exactly as the
	// matcher does. Without it this over-reports nothing and under-reports the
	// own-imported jobs the matcher will in fact score.
	const eligibilityFilter = buildEligibilityFilter(
		{ work_location: workLocations, job_types: jobTypes, experience_levels: experienceLevels },
		profileSkills,
		profileId
	);

	const result = await queryRaw<{ cnt: number }>(sql`
    SELECT COUNT(*)::int as cnt
    ${from}
    LEFT JOIN job_matches jm ON j.id = jm.job_id AND jm.profile_id = ${profileId}
    ${where}
    AND jm.id IS NULL
    AND ${eligibilityFilter}
  `);

	return result[0]?.cnt ?? 0;
}

/**
 * Measure a profile's skill vocabulary against the corpus it is matched on.
 *
 * See SkillVocabularyReach for what the number means and why it is not wired
 * into the matcher.
 *
 * Scoped by match_community_jobs like every other count here, so an applicant
 * who only matches their own imports is measured against their own imports.
 * Uses getExpandedProfileSkills, and normalizes both sides exactly as the gate
 * does, so the figure describes the real gate rather than an idealised one.
 */
export async function getSkillVocabularyReach(
	profileId: number,
	matchCommunityJobs: boolean,
	communityMaxAgeDays?: number | null
): Promise<SkillVocabularyReach> {
	const profileSkills = await getExpandedProfileSkills(profileId);
	const normalized = [...new Set(profileSkills.map(normalizeSkill).filter((s) => s.length > 0))];

	if (normalized.length === 0) {
		return { jobsWithSkills: 0, reachedJobs: 0, percentage: null, profileSkillCount: 0 };
	}

	const { from, where } = buildVisibilityScope(profileId, matchCommunityJobs, communityMaxAgeDays);

	// CASE rather than an OR/AND chain around jsonb_array_length for the reason
	// spelled out in eligibility.ts: it raises on JSON null, 17 preview rows
	// store JSON null, and operand order in a boolean chain is the planner's
	// choice rather than a guarantee.
	const result = await queryRaw<{ with_skills: number; reached: number }>(sql`
    SELECT
      COUNT(DISTINCT j.id) FILTER (WHERE
        (CASE WHEN jsonb_typeof(j.skills_required::jsonb) = 'array'
              THEN jsonb_array_length(j.skills_required::jsonb) ELSE 0 END)
        + (CASE WHEN jsonb_typeof(j.skills_preferred::jsonb) = 'array'
              THEN jsonb_array_length(j.skills_preferred::jsonb) ELSE 0 END) > 0
      )::int AS with_skills,
      COUNT(DISTINCT j.id) FILTER (WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(
          (CASE WHEN jsonb_typeof(j.skills_required::jsonb) = 'array'
                THEN j.skills_required::jsonb ELSE '[]'::jsonb END)
          || (CASE WHEN jsonb_typeof(j.skills_preferred::jsonb) = 'array'
                THEN j.skills_preferred::jsonb ELSE '[]'::jsonb END)
        ) AS elem
        WHERE regexp_replace(lower(elem), '[^a-z0-9+#]', '', 'g')
              = ANY(array[${sqlJoin(normalized)}]::text[])
      ))::int AS reached
    ${from}
    ${where}
  `);

	const jobsWithSkills = result[0]?.with_skills ?? 0;
	const reachedJobs = result[0]?.reached ?? 0;

	return {
		jobsWithSkills,
		reachedJobs,
		percentage: jobsWithSkills > 0 ? Math.round((reachedJobs / jobsWithSkills) * 100) : null,
		profileSkillCount: normalized.length
	};
}

/**
 * Count unmatched community jobs for multiple time windows at once.
 * Returns a map of { days: count } for the given windows, plus null for "all time".
 * Only counts community jobs (excludes own-imported jobs from the count).
 */
export async function getCommunityJobCountsByWindow(
	profileId: number,
	windows: (number | null)[]
): Promise<Map<number | null, number>> {
	const result = await queryRaw<{ days: number | null; cnt: number }>(sql`
    SELECT
      w.days,
      COUNT(DISTINCT j.id)::int AS cnt
    FROM UNNEST(ARRAY[${sqlJoin(windows.map((w) => w ?? -1))}]::int[]) AS w(days)
    LEFT JOIN jobs j ON j.status != 'archived'
      AND j.id NOT IN (SELECT ji.job_id FROM job_importers ji WHERE ji.profile_id = ${profileId})
      AND (w.days = -1 OR j.date_created >= NOW() - MAKE_INTERVAL(days => w.days))
    LEFT JOIN job_matches jm ON j.id = jm.job_id AND jm.profile_id = ${profileId}
    WHERE jm.id IS NULL
    GROUP BY w.days
    ORDER BY w.days
  `);

	const map = new Map<number | null, number>();
	for (const row of result) {
		const key = row.days === -1 ? null : row.days;
		map.set(key, row.cnt);
	}
	return map;
}
