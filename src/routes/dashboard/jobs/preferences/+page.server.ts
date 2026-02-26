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

const REMOTE_OPTIONS = ["Remote", "Hybrid", "On-site"];

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const profileId = layoutData.selectedProfile.id;

  // Get existing preferences for this profile
  const preferences = await db.job_match_preferences.findFirst({
    where: { profile: profileId },
  });

  return {
    preferences: preferences
      ? {
          id: preferences.id,
          job_types: (preferences.job_types as string[]) || [],
          experience_levels: (preferences.experience_levels as string[]) || [],
          remote_options: (preferences.remote_options as string[]) || [],
          locations: (preferences.locations as string[]) || [],
        }
      : null,
    options: {
      jobTypes: JOB_TYPES,
      experienceLevels: EXPERIENCE_LEVELS,
      remoteOptions: REMOTE_OPTIONS,
    },
    profileId,
  };
};
