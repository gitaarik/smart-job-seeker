/**
 * Utility functions for job matching
 */

import { dbDirect as db } from "$lib/server/db";
import type { jobs } from "../../../generated/prisma/client";

/**
 * Extract tech skills from a profile
 * @param profileId - Profile ID to extract skills from
 * @returns Array of skill names
 */
export async function getProfileSkills(profileId: number): Promise<string[]> {
  const skills = await db.tech_skills.findMany({
    where: {
      tech_skill_categories: {
        profile: profileId,
      },
    },
    select: {
      name: true,
    },
  });

  return skills
    .map((s) => s.name)
    .filter((name): name is string => !!name);
}

/**
 * Check if two arrays have any overlapping elements
 * @param arr1 - First array
 * @param arr2 - Second array
 * @returns True if arrays have at least one common element
 */
export function hasArrayOverlap<T>(arr1: T[], arr2: T[]): boolean {
  if (!arr1 || !arr2 || arr1.length === 0 || arr2.length === 0) {
    return false;
  }
  return arr1.some((item) => arr2.includes(item));
}

/**
 * Check if a job needs re-matching based on its last update timestamp
 * @param profileId - Profile ID
 * @param jobId - Job ID
 * @param job - Job object with date_updated
 * @returns True if job needs re-matching
 */
export async function needsRematching(
  profileId: number,
  jobId: number,
  job: jobs,
): Promise<boolean> {
  const existingMatch = await db.job_matches.findFirst({
    where: {
      profile: profileId,
      job: jobId,
    },
    select: {
      job_date_updated_when_matched: true,
    },
  });

  if (!existingMatch) {
    return true; // New match
  }

  // Re-match if job was updated after last matching
  if (
    !existingMatch.job_date_updated_when_matched ||
    !job.date_updated
  ) {
    return true; // Missing timestamps, re-match to be safe
  }

  return new Date(job.date_updated) >
    new Date(existingMatch.job_date_updated_when_matched);
}

/**
 * Match location strings with flexible contains matching
 * Supports exact match, contains match, and special "remote" handling
 * @param jobLocation - Job location string (can be null for remote jobs)
 * @param preferredLocations - Array of preferred location strings
 * @returns True if location matches preferences
 */
export function matchesLocation(
  jobLocation: string | null,
  preferredLocations: string[],
): boolean {
  // Remote jobs (null/empty location) always match
  if (!jobLocation || jobLocation.trim() === "") {
    return true;
  }

  // No location preferences means all locations are acceptable
  if (!preferredLocations || preferredLocations.length === 0) {
    return true;
  }

  const normalizedJobLoc = jobLocation.toLowerCase().trim();

  return preferredLocations.some((prefLoc) => {
    const normalizedPref = prefLoc.toLowerCase().trim();

    // Exact match
    if (normalizedJobLoc === normalizedPref) return true;

    // Contains match (e.g., "Amsterdam, Netherlands" contains "Amsterdam")
    if (normalizedJobLoc.includes(normalizedPref)) return true;

    // Reverse contains (e.g., "Amsterdam" matches preference "Amsterdam, Netherlands")
    if (normalizedPref.includes(normalizedJobLoc)) return true;

    // Special case: "Remote" matches remote-related terms
    if (normalizedPref === "remote") {
      return (
        normalizedJobLoc.includes("remote") ||
        normalizedJobLoc.includes("anywhere") ||
        normalizedJobLoc.includes("worldwide")
      );
    }

    return false;
  });
}
