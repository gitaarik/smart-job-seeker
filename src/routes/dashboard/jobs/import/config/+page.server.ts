import type { PageServerLoad } from "./$types";
import { dbDirect as db } from "$lib/server/db";

// Preference options for the matching config form.
// These are the values stored in the database. They don't map 1:1 to the
// taxonomy's canonical values (e.g. "Freelance" is a user-facing preference
// but normalizes to "contract" for matching). Keep in sync manually for now.
const JOB_TYPES = [
  "Full-time",
  "Part-time",
  "Contract",
  "Freelance",
  "Internship",
];

const EXPERIENCE_LEVELS = [
  "Entry-level",
  "Mid-level",
  "Senior",
  "Lead",
  "Executive",
];

const WORK_LOCATION_OPTIONS = ["Remote", "Hybrid", "On-site"];

export const load: PageServerLoad = async ({ parent }) => {
  const { profileId } = await parent();

  // Get or auto-create config for this profile
  let config = await db.query.match_config.findFirst({
    where: { profile_id: profileId },
  });

  if (!config) {
    config = await db.match_config.create({
      data: {
        profile_id: profileId,
        date_created: new Date(),
        date_updated: new Date(),
      },
    });
  }

  return {
    config: {
      id: config.id,
      job_types: (config.job_types as string[]) || [],
      experience_levels: (config.experience_levels as string[]) || [],
      work_location: (config.work_location as string[]) || [],
      locations: (config.locations as string[]) || [],
      remote_only: config.remote_only,
      match_community_jobs: config.match_community_jobs,
      community_max_age_days: (config as Record<string, unknown>).community_max_age_days as number | null ?? null,
    },
    options: {
      jobTypes: JOB_TYPES,
      experienceLevels: EXPERIENCE_LEVELS,
      workLocationOptions: WORK_LOCATION_OPTIONS,
    },
  };
};
