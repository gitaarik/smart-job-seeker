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

  // Normalize config values: lowercase + strip hyphens/underscores/spaces
  // This ensures "Full-time" matches "full_time", "fulltime", etc.
  const normalizeValue = (v: string) =>
    v.toLowerCase().replace(/[-_\s]/g, "");
  const workLocations = config.work_location.map(normalizeValue);

  // Expand job types to include related scraped variants so e.g.
  // "contract" also matches "one-time project", "freelance", "contractor", etc.
  const contractFamily = [
    "onetimeproject", "contractor", "freelance", "fixedprice",
    "hourly", "hourlycontract", "temporary", "temptohire", "ftc",
    "freelancecontract", "contractorassignmentfreelancer",
  ];
  const fullTimeFamily = ["fulltime", "permanent"];

  const expandedJobTypes = new Set(config.job_types.map(normalizeValue));
  if (expandedJobTypes.has("contract")) {
    for (const v of contractFamily) expandedJobTypes.add(v);
  }
  if (expandedJobTypes.has("fulltime")) {
    for (const v of fullTimeFamily) expandedJobTypes.add(v);
  }
  const jobTypes = [...expandedJobTypes];

  return Prisma.sql`
    -- Minimum data: job must have a description OR at least one skill
    (
      (j.job_description IS NOT NULL AND TRIM(j.job_description) != '')
      OR (j.skills_required IS NOT NULL AND j.skills_required::text != 'null' AND jsonb_array_length(j.skills_required::jsonb) > 0)
      OR (j.skills_preferred IS NOT NULL AND j.skills_preferred::text != 'null' AND jsonb_array_length(j.skills_preferred::jsonb) > 0)
    )
    -- Work location overlap — normalized (case + separator insensitive)
    AND (
      j.work_location IS NULL
      OR j.work_location::text = 'null'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(j.work_location::jsonb) AS elem
        WHERE regexp_replace(lower(elem), '[-_ ]', '', 'g') = ANY(array[${Prisma.join(workLocations)}]::text[])
      )
    )
    -- Job types overlap — normalized (case + separator insensitive)
    AND (
      j.job_types IS NULL
      OR j.job_types::text = 'null'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(j.job_types::jsonb) AS elem
        WHERE regexp_replace(lower(elem), '[-_ ]', '', 'g') = ANY(array[${Prisma.join(jobTypes)}]::text[])
      )
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
