/**
 * Core job matching engine
 * Filters jobs based on preferences and calculates LLM-based match scores
 */

import { Prisma } from "../../../../generated/prisma/client";
import { dbDirect as db } from "$lib/server/db";
import { createJobMatchingAiChat } from "$lib/server/ai-chat/job-utils";
import { hasArrayOverlap, matchesLocation } from "./match-utils";
import type {
  job_match_preferences,
  jobs,
} from "../../../../generated/prisma/client";

/**
 * Job match preferences type
 */
export interface JobMatchPreferences {
  id: number;
  profile: number;
  job_types: string[] | null;
  experience_levels: string[] | null;
  remote_options: string[] | null;
  locations: string[] | null;
}

/**
 * Match result from LLM scoring
 */
export interface MatchResult {
  profileId: number;
  jobId: number;
  score: number;
  reasoning: string;
  skill_match_percentage: number;
  matched_skills: string[];
  strengths: string[];
  gaps: string[];
  recommendation: string;
  jobDateUpdated: Date | null;
  llmPrompt: string;
  ai_chat_scoring: number | null;
}

/**
 * Get matching preferences for a profile
 * @param profileId - Profile ID
 * @returns Matching preferences or null if not found
 */
export async function getMatchingPreferences(
  profileId: number,
): Promise<JobMatchPreferences | null> {
  const prefs = await db.job_match_preferences.findFirst({
    where: { profile: profileId },
  });

  if (!prefs) {
    return null;
  }

  return {
    id: prefs.id,
    profile: prefs.profile,
    job_types: prefs.job_types as string[] | null,
    experience_levels: prefs.experience_levels as string[] | null,
    remote_options: prefs.remote_options as string[] | null,
    locations: prefs.locations as string[] | null,
  };
}

/**
 * Filter jobs that meet basic matching requirements
 * Uses PostgreSQL JSON operators for efficient filtering
 * @param preferences - User's matching preferences
 * @param profileSkills - User's technical skills
 * @param jobIds - Optional array of specific job IDs to filter
 * @returns Array of eligible jobs
 */
export async function filterEligibleJobs(
  preferences: JobMatchPreferences,
  profileSkills: string[],
  jobIds?: number[],
): Promise<jobs[]> {
  // Build job IDs filter if provided
  const jobIdFilter = jobIds && jobIds.length > 0
    ? Prisma.sql`AND j.id = ANY(${jobIds})`
    : Prisma.empty;

  // Build remote options filter (REQUIRED)
  if (
    !preferences.remote_options ||
    preferences.remote_options.length === 0
  ) {
    throw new Error(
      "Remote options preferences are required for job matching",
    );
  }

  // Build job types filter (REQUIRED)
  if (!preferences.job_types || preferences.job_types.length === 0) {
    throw new Error("Job types preferences are required for job matching");
  }

  // Skills filter (AT LEAST ONE match required)
  if (!profileSkills || profileSkills.length === 0) {
    throw new Error(
      "Profile must have at least one skill for job matching",
    );
  }

  // Use raw SQL with PostgreSQL's ?| operator for JSON array overlap
  const jobs = await db.$queryRaw<jobs[]>`
    SELECT j.* FROM jobs j
    WHERE j.status != 'archived'
    ${jobIdFilter}
    -- Work location overlap (REQUIRED)
    AND (
      j.work_location IS NULL
      OR j.work_location::jsonb ?| array[${
    Prisma.join(preferences.remote_options)
  }]::text[]
    )
    -- Job types overlap (REQUIRED)
    AND (
      j.job_types IS NULL
      OR j.job_types::jsonb ?| array[${
    Prisma.join(preferences.job_types)
  }]::text[]
    )
    -- Skills overlap (AT LEAST ONE match in required OR preferred)
    AND (
      (j.skills_required IS NULL AND j.skills_preferred IS NULL)
      OR j.skills_required::jsonb ?| array[${
    Prisma.join(profileSkills)
  }]::text[]
      OR j.skills_preferred::jsonb ?| array[${
    Prisma.join(profileSkills)
  }]::text[]
    )
  `;

  // Apply location filter in memory (more flexible matching)
  if (preferences.locations && preferences.locations.length > 0) {
    return jobs.filter((job) =>
      matchesLocation(job.office_location, preferences.locations!)
    );
  }

  return jobs;
}

/**
 * Calculate match score using LLM
 * @param profileId - Profile ID
 * @param job - Job to match against
 * @param preferences - User's matching preferences
 * @returns Match result with score and details
 */
export async function calculateMatch(
  profileId: number,
  job: jobs,
  preferences: JobMatchPreferences,
): Promise<MatchResult> {
  // Get latest collected data for profile
  const collectedData = await db.collected_data.findFirst({
    where: { profile: profileId },
    orderBy: { date_updated: "desc" },
  });

  if (!collectedData) {
    throw new Error(
      `No collected_data found for profile ${profileId}`,
    );
  }

  // Call AI chat utility to calculate job match score
  const aiResult = await createJobMatchingAiChat<{
    score: number;
    reasoning: string;
    skill_match_percentage: number;
    matched_skills: string[];
    strengths: string[];
    gaps: string[];
    recommendation: string;
  }>(profileId, "score_job_match", {
    schema: collectedData.schema || "",
    data: collectedData.data || "",

    // Preferences variables
    "preferences.job_types": preferences.job_types
      ? JSON.stringify(preferences.job_types)
      : "Any",
    "preferences.experience_levels": preferences.experience_levels
      ? JSON.stringify(preferences.experience_levels)
      : "Any",
    "preferences.remote_options": preferences.remote_options
      ? JSON.stringify(preferences.remote_options)
      : "Any",
    "preferences.locations": preferences.locations
      ? JSON.stringify(preferences.locations)
      : "Any",

    // Job variables
    "job.title": job.title || "Unknown",
    "job.job_poster": job.job_poster || "Unknown",
    "job.office_location": job.office_location || "Remote/Not specified",
    "job.job_types": job.job_types
      ? JSON.stringify(job.job_types)
      : "Not specified",
    "job.experience_levels": job.experience_levels
      ? JSON.stringify(job.experience_levels)
      : "Not specified",
    "job.work_location": job.work_location
      ? JSON.stringify(job.work_location)
      : "Not specified",
    "job.skills_required": job.skills_required
      ? JSON.stringify(job.skills_required)
      : "Not specified",
    "job.skills_preferred": job.skills_preferred
      ? JSON.stringify(job.skills_preferred)
      : "Not specified",
    "job.job_description": job.job_description || "No description provided",
    "job.company_description": job.company_description || "",
  });

  if (!aiResult.success || !aiResult.response) {
    throw new Error(`Failed to calculate match score: ${aiResult.message}`);
  }

  const result = aiResult.response;

  // Build job skills list for validation
  const jobSkillsRequired = Array.isArray(job.skills_required) ? job.skills_required as string[] : [];
  const jobSkillsPreferred = Array.isArray(job.skills_preferred) ? job.skills_preferred as string[] : [];
  const allJobSkills = [...jobSkillsRequired, ...jobSkillsPreferred];
  const jobSkillsLower = new Map(allJobSkills.map(s => [s.toLowerCase(), s]));

  // Extract matched skills via separate focused request (more reliable than getting it from score_job_match)
  let validatedMatchedSkills: string[] = [];

  if (allJobSkills.length > 0) {
    try {
      const skillsResult = await createJobMatchingAiChat<
        { matched_skills: string[] } | Record<string, boolean | unknown[]>
      >(profileId, "extract_matched_skills", {
        "job.skills": allJobSkills.join("\n"),
        "profile.data": collectedData.data || "",
      });

      if (skillsResult.success && skillsResult.response) {
        let rawSkills: string[] = [];

        // Handle array format: { matched_skills: ["Python", "React"] }
        if ("matched_skills" in skillsResult.response && Array.isArray(skillsResult.response.matched_skills)) {
          rawSkills = skillsResult.response.matched_skills;
        }
        // Handle object format: { "Python": true, "React": true, "Go": false }
        // Extract keys where value is truthy (true or non-empty array)
        else if (typeof skillsResult.response === "object") {
          rawSkills = Object.entries(skillsResult.response)
            .filter(([, value]) => value === true || (Array.isArray(value) && value.length > 0))
            .map(([skill]) => skill);
        }

        // Validate: only keep skills that actually exist in the job's skill lists
        validatedMatchedSkills = rawSkills
          .map(skill => jobSkillsLower.get(skill.toLowerCase()))
          .filter((skill): skill is string => skill !== undefined);
      }
    } catch (error) {
      // Log but don't fail the whole match if skill extraction fails
      console.warn(`[Matcher] Failed to extract matched skills for job ${job.id}:`, error);
    }
  }

  return {
    profileId,
    jobId: job.id,
    score: result.score,
    reasoning: result.reasoning,
    skill_match_percentage: result.skill_match_percentage,
    matched_skills: validatedMatchedSkills,
    strengths: result.strengths,
    gaps: result.gaps,
    recommendation: result.recommendation,
    jobDateUpdated: job.date_updated,
    llmPrompt: "", // Prompt is stored in ai_chats table via ai_chat_scoring link
    ai_chat_scoring: aiResult.aiChatId,
  };
}

/**
 * Get jobs that need matching (no existing match for this profile)
 * Uses an efficient LEFT JOIN query to find unmatched jobs
 * @param profileId - Profile ID to check matches for
 * @param preferences - User's matching preferences for filtering
 * @param profileSkills - User's technical skills for filtering
 * @param limit - Maximum number of jobs to return
 * @returns Array of unmatched eligible jobs
 */
export async function getUnmatchedJobs(
  profileId: number,
  preferences: JobMatchPreferences,
  profileSkills: string[],
  limit: number = 50,
): Promise<jobs[]> {
  // Validate required preferences
  if (
    !preferences.remote_options ||
    preferences.remote_options.length === 0
  ) {
    throw new Error(
      "Remote options preferences are required for job matching",
    );
  }

  if (!preferences.job_types || preferences.job_types.length === 0) {
    throw new Error("Job types preferences are required for job matching");
  }

  if (!profileSkills || profileSkills.length === 0) {
    throw new Error(
      "Profile must have at least one skill for job matching",
    );
  }

  // Query for jobs that have no match record for this profile
  // Combined with the same eligibility filters as filterEligibleJobs
  const jobs = await db.$queryRaw<jobs[]>`
    SELECT j.* FROM jobs j
    LEFT JOIN job_matches jm ON j.id = jm.job AND jm.profile = ${profileId}
    WHERE jm.id IS NULL
    AND j.status != 'archived'
    -- Work location overlap (REQUIRED)
    AND (
      j.work_location IS NULL
      OR j.work_location::jsonb ?| array[${Prisma.join(preferences.remote_options)}]::text[]
    )
    -- Job types overlap (REQUIRED)
    AND (
      j.job_types IS NULL
      OR j.job_types::jsonb ?| array[${Prisma.join(preferences.job_types)}]::text[]
    )
    -- Skills overlap (AT LEAST ONE match in required OR preferred)
    AND (
      (j.skills_required IS NULL AND j.skills_preferred IS NULL)
      OR j.skills_required::jsonb ?| array[${Prisma.join(profileSkills)}]::text[]
      OR j.skills_preferred::jsonb ?| array[${Prisma.join(profileSkills)}]::text[]
    )
    ORDER BY j.date_created DESC
    LIMIT ${limit}
  `;

  // Apply location filter in memory (more flexible matching)
  if (preferences.locations && preferences.locations.length > 0) {
    return jobs.filter((job) =>
      matchesLocation(job.office_location, preferences.locations!)
    );
  }

  return jobs;
}

/**
 * Create or update job match record
 * @param match - Match result to save
 * @returns Object with match ID and whether it was created or updated
 */
export async function upsertJobMatch(
  match: MatchResult,
): Promise<{ id: number; created: boolean }> {
  // Check if match exists
  const existing = await db.job_matches.findFirst({
    where: {
      profile: match.profileId,
      job: match.jobId,
    },
  });

  const currentDate = new Date();

  const matchData = {
    score: match.score,
    reasoning: match.reasoning,
    skill_match_percentage: match.skill_match_percentage,
    matched_skills: match.matched_skills,
    strengths: match.strengths,
    gaps: match.gaps,
    recommendation: match.recommendation,
    job_date_updated_when_matched: match.jobDateUpdated || currentDate,
    profile: match.profileId,
    date_updated: currentDate,
    llm_prompt: match.llmPrompt,
    ai_chat_scoring: match.ai_chat_scoring,
  };

  if (existing) {
    // Update existing match
    await db.job_matches.update({
      where: { id: existing.id },
      data: matchData,
    });
    return { id: existing.id, created: false };
  } else {
    // Create new match
    const newMatch = await db.job_matches.create({
      data: {
        ...matchData,
        job: match.jobId,
        status: "new",
        date_created: currentDate,
      },
    });
    return { id: newMatch.id, created: true };
  }
}
