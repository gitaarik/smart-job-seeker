/**
 * Core job matching engine
 * Filters jobs based on preferences and calculates LLM-based match scores
 */

import { Prisma } from "../../../generated/prisma/client";
import { dbDirect as db } from "$lib/db";
import { generateChatCompletion } from "./llm";
import { interpolatePrompt } from "./ai-chat-utils";
import { hasArrayOverlap, matchesLocation } from "./job-match-utils";
import type {
  job_match_preferences,
  jobs,
} from "../../../generated/prisma/client";

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
  strengths: string[];
  gaps: string[];
  recommendation: string;
  jobDateUpdated: Date | null;
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
    -- Remote options overlap (REQUIRED)
    AND (
      j.remote_options IS NULL
      OR j.remote_options::jsonb ?| array[${
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
    -- Skills overlap (AT LEAST ONE)
    AND (
      j.skills IS NULL
      OR j.skills::jsonb ?| array[${Prisma.join(profileSkills)}]::text[]
    )
  `;

  // Apply location filter in memory (more flexible matching)
  if (preferences.locations && preferences.locations.length > 0) {
    return jobs.filter((job) =>
      matchesLocation(job.location, preferences.locations!)
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

  // Get prompt template
  const template = await db.ai_chat_prompts.findUnique({
    where: { request: "score_job_match" },
  });

  if (!template) {
    throw new Error("Prompt template 'score_job_match' not found");
  }

  // Prepare job data for prompt
  const jobData = {
    title: job.title || "Unknown",
    job_poster: job.job_poster || "Unknown",
    location: job.location || "Remote/Not specified",
    job_types: job.job_types ? JSON.stringify(job.job_types) : "Not specified",
    experience_levels: job.experience_levels
      ? JSON.stringify(job.experience_levels)
      : "Not specified",
    remote_options: job.remote_options
      ? JSON.stringify(job.remote_options)
      : "Not specified",
    skills: job.skills ? JSON.stringify(job.skills) : "Not specified",
    job_description: job.job_description || "No description provided",
    company_description: job.company_description || "",
  };

  // Prepare preferences data for prompt
  const preferencesData = {
    job_types: preferences.job_types
      ? JSON.stringify(preferences.job_types)
      : "Any",
    experience_levels: preferences.experience_levels
      ? JSON.stringify(preferences.experience_levels)
      : "Any",
    remote_options: preferences.remote_options
      ? JSON.stringify(preferences.remote_options)
      : "Any",
    locations: preferences.locations
      ? JSON.stringify(preferences.locations)
      : "Any",
  };

  // Interpolate prompts
  const systemPrompt = template.system_prompt || "";
  const userPrompt = interpolatePrompt(template.user_prompt || "", {
    schema: collectedData.schema || "",
    data: collectedData.data || "",
    preferences: preferencesData,
    job: jobData,
  });

  // Prepare structured output format
  const responseFormat = template.format
    ? {
      type: "json_schema" as const,
      json_schema: {
        name: "job_match_score",
        strict: true,
        schema: template.format as Record<string, any>,
      },
    }
    : undefined;

  // Call LLM
  const response = await generateChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.3, responseFormat },
  );

  // Parse response
  try {
    const result = JSON.parse(response);

    return {
      profileId,
      jobId: job.id,
      score: result.score,
      reasoning: result.reasoning,
      skill_match_percentage: result.skill_match_percentage,
      strengths: result.strengths,
      gaps: result.gaps,
      recommendation: result.recommendation,
      jobDateUpdated: job.date_updated,
    };
  } catch (error) {
    console.error("Failed to parse match score from LLM:", error);
    console.error("Response was:", response);
    throw new Error(
      `Failed to calculate match score for job ${job.id}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
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
    strengths: match.strengths,
    gaps: match.gaps,
    recommendation: match.recommendation,
    job_date_updated_when_matched: match.jobDateUpdated || currentDate,
    profile: match.profileId,
    date_updated: currentDate,
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
