import { sqlJoin, sql } from '$lib/server/db';
/**
 * Shared eligibility filter for job matching SQL queries.
 *
 * This is the SINGLE SOURCE OF TRUTH for eligibility SQL conditions.
 * Used by the matcher (getUnmatchedJobs, filterEligibleJobs) and the
 * matcher status API (eligible unmatched count).
 *
 * Job type and work location variants are defined in job-taxonomy.ts.
 * If you add a new filter dimension, update BOTH this function AND
 * checkEligibility() in cloud/src/server/job/matcher.ts (the in-memory version
 * that produces human-readable failure reasons).
 */

import { type SQL } from 'drizzle-orm';
import { JOB_TYPES, WORK_LOCATIONS, buildFamilyMap } from '$lib/data/job-taxonomy';
import { expandExperienceBuckets, toExperienceBuckets } from '$lib/job-platforms/search-filters';
import { normalizeSkill } from '$lib/skills';

/**
 * Does the skill-overlap gate get a vote on this job?
 *
 * THE shared rule. `checkEligibility` in cloud/src/server/job/matcher.ts
 * imports this rather than re-deciding, because the two used to disagree and
 * the disagreement was not academic. This one skipped the gate when EITHER
 * skill list was empty; the in-memory one skipped it only when BOTH were. On
 * preview 2026-09-01, 2,466 of 5,271 skill-carrying jobs (47%) list no
 * preferred skills, so for those the cycle path (SQL, this file) scored the job
 * while the import path (in-memory) wrote it off at 0. Same job, same profile,
 * different verdict depending on which queue it arrived through. Profile 58 had
 * 2,414 jobs in that disputed set — for a thin profile the two paths agreed
 * about almost nothing.
 *
 * ## Why the lenient rule won
 *
 * Making both sides strict is the tidier-looking fix and it is the wrong one.
 * Of profile 1's jobs that reach the LLM only because this clause let them
 * past, 11 scored >= 70 and one scored 98. The exact-string gate has good
 * PRECISION (it vetoes a population 10-14x less likely to be a strong match,
 * for a profile whose vocabulary the corpus shares) and bad RECALL: 9,581 of
 * the corpus's 14,657 distinct skill strings occur exactly once, so a zero
 * means "these lists share no literal string", never "this job is irrelevant".
 *
 * So the empty-preferred escape is load-bearing by accident. That is worth
 * saying plainly rather than dressing up: "both lists are non-empty" is not a
 * principled statement about when skills are comparable, it is a proxy that
 * happens to disable a lossy gate on the half of the corpus where it does most
 * of its damage. It stays until the gate is replaced by something with real
 * recall, and then this goes with it.
 *
 * Tolerates non-arrays because the columns are jsonb and carry SQL NULL, JSON
 * null and arrays; the SQL side guards the same three shapes.
 */
export function skillGateApplies(skillsRequired: unknown, skillsPreferred: unknown): boolean {
	const required = Array.isArray(skillsRequired) ? skillsRequired : [];
	const preferred = Array.isArray(skillsPreferred) ? skillsPreferred : [];
	return required.length > 0 && preferred.length > 0;
}

export interface EligibilityConfig {
	work_location: string[] | null;
	job_types: string[] | null;
	// Optional: when set (and non-empty), jobs must overlap one of the requested
	// experience-level buckets. Unset = no experience filter (any level).
	experience_levels?: string[] | null;
}

// Taxonomy-derived family expansion maps (built once at module load)
const workLocationFamilies = buildFamilyMap(WORK_LOCATIONS);
const jobTypeFamilies = buildFamilyMap(JOB_TYPES);

/**
 * Build a SQL WHERE clause fragment for job eligibility filtering.
 *
 * Assumes the jobs table is aliased as `j` in the outer query.
 *
 * Filters applied:
 * - work_location overlap (NULL/json-null = any)
 * - job_types overlap (NULL/json-null = any)
 * - skills overlap in required OR preferred (NULL/json-null = any)
 * - experience_level bucket overlap (only when config.experience_levels is set)
 */
export function buildEligibilityFilter(
	config: EligibilityConfig,
	profileSkills: string[],
	/**
	 * Profile whose own imports are exempt from the skill-overlap clause.
	 *
	 * Omit and nothing is exempt, which is the old behaviour. See the clause
	 * itself for why importing a job counts as evidence the skill strings do not
	 * have.
	 */
	profileId?: number
): SQL {
	if (!config.work_location || config.work_location.length === 0) {
		throw new Error('Work location config is required for job matching');
	}
	if (!config.job_types || config.job_types.length === 0) {
		throw new Error('Job types config is required for job matching');
	}
	if (!profileSkills || profileSkills.length === 0) {
		throw new Error('Profile must have at least one skill for job matching');
	}

	// Normalized once for the skill clause below. The empty-string filter is
	// load-bearing: a skill written "---" normalizes to "", and an "" in this
	// array would answer every job skill that also normalizes to "" — turning a
	// junk profile row into blanket eligibility.
	const normalizedProfileSkills = [
		...new Set(profileSkills.map(normalizeSkill).filter((s) => s.length > 0))
	];
	if (normalizedProfileSkills.length === 0) {
		throw new Error('Profile must have at least one skill for job matching');
	}

	// Normalize config values: lowercase + strip hyphens/underscores/spaces
	// This ensures "Full-time" matches "full_time", "fulltime", etc.
	const normalizeValue = (v: string) => v.toLowerCase().replace(/[-_\s]/g, '');

	// Expand work locations to include multilingual variants from the taxonomy
	// e.g. "hybrid" also matches "in overleg" (Dutch), "nach absprache" (German), etc.
	const expandedWorkLocations = new Set(config.work_location.map(normalizeValue));
	workLocationFamilies.forEach((family, canonical) => {
		if (expandedWorkLocations.has(canonical)) {
			family.forEach((v) => expandedWorkLocations.add(v));
		}
	});
	const workLocations = Array.from(expandedWorkLocations);

	// Expand job types to include related scraped variants from the taxonomy
	// e.g. "contract" also matches "one-time project", "freelance", "contractor", etc.
	const expandedJobTypes = new Set(config.job_types.map(normalizeValue));
	jobTypeFamilies.forEach((family, canonical) => {
		if (expandedJobTypes.has(canonical)) {
			family.forEach((v) => expandedJobTypes.add(v));
		}
	});
	const jobTypes = Array.from(expandedJobTypes);

	// Experience level overlap — only constrains when the user set a preference.
	// Job rows store fine-grained taxonomy levels (junior, mid_senior, staff…);
	// expandExperienceBuckets() turns the user's bucket selection into the full
	// set of taxonomy terms that map into those buckets, so the membership check
	// mirrors the source-side filter exactly.
	const experienceBuckets = config.experience_levels
		? toExperienceBuckets(config.experience_levels)
		: [];
	const experienceTerms = expandExperienceBuckets(experienceBuckets);
	const experienceClause =
		experienceTerms.length > 0
			? sql`
    AND (
      j.experience_levels IS NULL
      OR j.experience_levels::text = 'null'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(j.experience_levels::jsonb) AS elem
        WHERE regexp_replace(lower(elem), '[-_ ]', '', 'g') = ANY(array[${sqlJoin(experienceTerms)}]::text[])
      )
    )`
			: sql``;

	/**
	 * A job the applicant imported themselves is never dropped for skill overlap.
	 *
	 * The comparison above is exact string equality against the profile's skill
	 * rows — no ontology path, no LLM, no synonyms — so a zero means "these two
	 * lists share no literal string", not "this job is irrelevant". That is a
	 * fine cost filter over the community pool, where the alternative is scoring
	 * thousands of postings nobody asked for. It is the wrong question entirely
	 * for a job the applicant went and imported: they ran the search, they chose
	 * the board, and the import IS the relevance signal. Vetoing it on a string
	 * comparison discards the one piece of evidence that did not come from
	 * guessing.
	 *
	 * Measured on preview 2026-08-31: of the jobs rejected pre-LLM for nothing
	 * but this clause, ALL 25 of profile 58's and 459 of profile 1's were the
	 * applicant's own imports. Profiles matching mostly community jobs are
	 * untouched, so the gate keeps doing the job it is actually good at.
	 *
	 * EXISTS rather than a join condition because two of the three callers do
	 * not join `job_importers` at all (`filterEligibleJobs` selects from `jobs`
	 * alone). `job_importers_profile_job_idx` covers this lookup.
	 */
	const ownImportEscape =
		profileId === undefined
			? sql``
			: sql`OR EXISTS (
        SELECT 1 FROM job_importers ji_elig
        WHERE ji_elig.job_id = j.id AND ji_elig.profile_id = ${profileId}
      )`;

	return sql`
    -- Minimum data: job must have a description OR at least one skill.
    -- CASE for the same reason as the skill clause below: jsonb_array_length()
    -- raises on JSON null, and the IS NOT NULL / != 'null' tests in front of it
    -- are not a guarantee that it runs second.
    (
      (j.job_description IS NOT NULL AND TRIM(j.job_description) != '')
      OR (CASE
            WHEN jsonb_typeof(j.skills_required::jsonb) IS DISTINCT FROM 'array' THEN FALSE
            ELSE jsonb_array_length(j.skills_required::jsonb) > 0
          END)
      OR (CASE
            WHEN jsonb_typeof(j.skills_preferred::jsonb) IS DISTINCT FROM 'array' THEN FALSE
            ELSE jsonb_array_length(j.skills_preferred::jsonb) > 0
          END)
    )
    -- Work location overlap — normalized (case + separator insensitive)
    -- Uses prefix matching to handle variants like "Hybrid (up to 3 remote days p/w)",
    -- "Remote in UK", and compound values like "On-site, Remote"
    AND (
      j.work_location IS NULL
      OR j.work_location::text = 'null'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(j.work_location::jsonb) AS elem
        WHERE regexp_replace(lower(elem), '[-_ ]', '', 'g') LIKE ANY(array[${sqlJoin(workLocations.map((wl) => '%' + wl + '%'))}]::text[])
      )
    )
    -- Job types overlap — normalized (case + separator insensitive)
    AND (
      j.job_types IS NULL
      OR j.job_types::text = 'null'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(j.job_types::jsonb) AS elem
        WHERE regexp_replace(lower(elem), '[-_ ]', '', 'g') = ANY(array[${sqlJoin(jobTypes)}]::text[])
      )
    )
    -- Skills overlap (AT LEAST ONE match in required OR preferred).
    --
    -- CASE, not an OR chain, and that is a correctness requirement rather than
    -- a style: jsonb_array_length() RAISES on a jsonb scalar, JSON null is a
    -- scalar, and 17 preview jobs store exactly that. An OR chain reads as if
    -- the type branches shield the length calls, but Postgres is free to
    -- reorder AND/OR operands and does — this same predicate written that way
    -- fails with "cannot get array length of a scalar" as soon as the planner
    -- picks a different order. CASE is documented to evaluate its WHENs in
    -- order and is the construct for guarding an expression that can error, so
    -- by the third WHEN both columns are known to be arrays.
    --
    -- IS DISTINCT FROM rather than <>, because jsonb_typeof() of a SQL NULL is
    -- NULL and NULL <> 'array' is itself NULL, which falls through instead of
    -- standing the gate down.
    --
    -- The first four WHENs are skillGateApplies() in SQL. See it for why the
    -- gate stands down when either list is empty.
    AND (
      (CASE
        WHEN jsonb_typeof(j.skills_required::jsonb) IS DISTINCT FROM 'array' THEN TRUE
        WHEN jsonb_typeof(j.skills_preferred::jsonb) IS DISTINCT FROM 'array' THEN TRUE
        WHEN jsonb_array_length(j.skills_required::jsonb) = 0 THEN TRUE
        WHEN jsonb_array_length(j.skills_preferred::jsonb) = 0 THEN TRUE
        -- normalizeSkill() in SQL, matching findExactSkillMatches() on the
        -- in-memory side. This used to be the jsonb any-key operator, which is
        -- raw byte equality: "Node.JS" did not answer "Node.js" here while it
        -- did there. Only 23 of profile 1's 5,349 jobs turn on it, but a gate
        -- that means two different things in two places is worth more than 23
        -- jobs. Both columns are arrays by this point, so the concatenation
        -- needs no guard of its own.
        ELSE EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(
            j.skills_required::jsonb || j.skills_preferred::jsonb
          ) AS elem
          WHERE regexp_replace(lower(elem), '[^a-z0-9+#]', '', 'g')
                = ANY(array[${sqlJoin(normalizedProfileSkills)}]::text[])
        )
      END)
      ${ownImportEscape}
    )
    ${experienceClause}
  `;
}
