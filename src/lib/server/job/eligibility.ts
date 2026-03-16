/**
 * Shared eligibility filter for job matching SQL queries.
 *
 * This is the SINGLE SOURCE OF TRUTH for eligibility SQL conditions.
 * Used by the matcher (getUnmatchedJobs, filterEligibleJobs) and the
 * matcher status API (eligible unmatched count).
 *
 * If you add a new filter dimension, update BOTH this function AND
 * checkEligibility() in cloud/src/server/job/matcher.ts (the in-memory version
 * that produces human-readable failure reasons).
 */

import { Prisma } from "../../../../generated/prisma/client";

export interface EligibilityConfig {
  work_location: string[];
  job_types: string[];
}

/**
 * Build a Prisma.Sql WHERE clause fragment for job eligibility filtering.
 *
 * Assumes the jobs table is aliased as `j` in the outer query.
 *
 * Filters applied:
 * - work_location overlap (NULL/json-null = any)
 * - job_types overlap (NULL/json-null = any)
 * - skills overlap in required OR preferred (NULL/json-null = any)
 */
export function buildEligibilityFilter(
  config: EligibilityConfig,
  profileSkills: string[],
): Prisma.Sql {
  if (!config.work_location || config.work_location.length === 0) {
    throw new Error("Work location config is required for job matching");
  }
  if (!config.job_types || config.job_types.length === 0) {
    throw new Error("Job types config is required for job matching");
  }
  if (!profileSkills || profileSkills.length === 0) {
    throw new Error("Profile must have at least one skill for job matching");
  }

  return Prisma.sql`
    -- Minimum data: job must have a description OR at least one skill
    (
      (j.job_description IS NOT NULL AND TRIM(j.job_description) != '')
      OR (j.skills_required IS NOT NULL AND j.skills_required::text != 'null' AND jsonb_array_length(j.skills_required::jsonb) > 0)
      OR (j.skills_preferred IS NOT NULL AND j.skills_preferred::text != 'null' AND jsonb_array_length(j.skills_preferred::jsonb) > 0)
    )
    -- Work location overlap (NULL/json-null = any)
    AND (
      j.work_location IS NULL
      OR j.work_location::text = 'null'
      OR j.work_location::jsonb ?| array[${
    Prisma.join(config.work_location)
  }]::text[]
    )
    -- Job types overlap
    AND (
      j.job_types IS NULL
      OR j.job_types::text = 'null'
      OR j.job_types::jsonb ?| array[${Prisma.join(config.job_types)}]::text[]
    )
    -- Skills overlap (AT LEAST ONE match in required OR preferred)
    AND (
      (j.skills_required IS NULL AND j.skills_preferred IS NULL)
      OR j.skills_required::text = 'null'
      OR j.skills_preferred::text = 'null'
      OR j.skills_required::jsonb ?| array[${
    Prisma.join(profileSkills)
  }]::text[]
      OR j.skills_preferred::jsonb ?| array[${
    Prisma.join(profileSkills)
  }]::text[]
    )
  `;
}
