import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";

// Standard options for the form
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
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const profileId = layoutData.selectedProfile.id;

  // Get existing config for this profile
  const config = await db.match_config.findFirst({
    where: { profile: profileId },
  });

  return {
    config: config
      ? {
          id: config.id,
          job_types: (config.job_types as string[]) || [],
          experience_levels: (config.experience_levels as string[]) || [],
          work_location: (config.work_location as string[]) || [],
          locations: (config.locations as string[]) || [],
          match_community_jobs: config.match_community_jobs,
        }
      : null,
    options: {
      jobTypes: JOB_TYPES,
      experienceLevels: EXPERIENCE_LEVELS,
      workLocationOptions: WORK_LOCATION_OPTIONS,
    },
    profileId,
  };
};
