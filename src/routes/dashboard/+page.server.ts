import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import { dbDirect as db, queryRaw, sql } from "$lib/server/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { match_config, profiles, search_tasks, job_matches, applications } from "$lib/server/db/schema";
import { getMatchCounts } from "$lib/server/job/match-counts";
import { getProfileSkillLevels } from "$lib/server/job/match-utils";
import {
  saveJob,
  unsaveJob,
  rejectJob,
  unrejectJob,
} from "$lib/server/job/job-actions";
import { getSelectedProfileId } from "./profile/utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    return {
      profileCompleteness: null,
      matchConfig: null,
      searchTasks: null,
      matchStats: null,
      topMatches: null,
      profileSkillLevels: {},
      activeApplications: [],
    };
  }

  const profileId = layoutData.selectedProfile.id;

  // Fetch match config first — needed for visibility scope in getMatchCounts
  const matchConfig = await db.query.match_config.findFirst({
    where: eq(match_config.profile_id, profileId),
    columns: {
      id: true,
      job_types: true,
      experience_levels: true,
      work_location: true,
      locations: true,
      match_community_jobs: true,
    },
  });

  const matchCommunityJobs = matchConfig?.match_community_jobs ?? false;

  const activeApplicationStatuses = ["preparing", "sent", "interviewing", "negotiating"];

  const [
    profileData,
    searchTasksList,
    [sharedMatchCounts, curationStatsRaw],
    topMatchesRaw,
    profileSkillLevels,
    activeApplications,
  ] = await Promise.all([
    // Lightweight profile fields for completeness check
    db.query.profiles.findFirst({
      where: eq(profiles.id, profileId),
      columns: {
        title: true,
        headline: true,
        city: true,
        country_code: true,
      },
      with: {
        tech_skill_categories: {
          columns: { id: true },
          with: { tech_skills: { columns: { id: true } } },
        },
        work_experiences: { columns: { id: true } },
        educations: { columns: { id: true } },
      },
    }),

    // Search tasks for this profile
    db.query.search_tasks.findMany({
      where: eq(search_tasks.profile_id, profileId),
      columns: {
        id: true,
        note: true,
        is_active: true,
        status: true,
        status_message: true,
        last_run: true,
        last_run_jobs_found: true,
      },
      with: {
        job_platform: { columns: { name: true } },
      },
      orderBy: desc(search_tasks.last_run),
    }),

    // Match stats — "total" uses shared getMatchCounts (same as Match Progress page)
    // while strong/saved/newUnreviewed still need job_statuses join
    Promise.all([
      getMatchCounts(profileId, matchCommunityJobs),
      queryRaw<
        [{ strong80: bigint; strong70: bigint; saved: bigint; new_unreviewed: bigint }]
      >(sql`
        SELECT
          COUNT(*) FILTER (WHERE jm.score >= 80 AND COALESCE(js.status, 'new') != 'rejected') as strong80,
          COUNT(*) FILTER (WHERE jm.score >= 70 AND COALESCE(js.status, 'new') != 'rejected') as strong70,
          COUNT(*) FILTER (WHERE js.status = 'saved') as saved,
          COUNT(*) FILTER (WHERE js.id IS NULL AND jm.score > 0) as new_unreviewed
        FROM job_matches jm
        LEFT JOIN job_statuses js ON js.profile = jm.profile_id AND js.job = jm.job_id
        WHERE jm.profile_id = ${profileId}
      `),
    ]),

    // Top 5 matches by score (excluding rejected via job_statuses)
    queryRaw<{ id: number }[]>(sql`
      SELECT jm.id
      FROM job_matches jm
      LEFT JOIN job_statuses js ON js.profile = jm.profile_id AND js.job = jm.job_id
      WHERE jm.profile_id = ${profileId}
      AND jm.score > 0
      AND COALESCE(js.status, 'new') != 'rejected'
      ORDER BY jm.score DESC
      LIMIT 5
    `).then(async (ids) => {
      if (ids.length === 0) return [];
      return db.query.job_matches.findMany({
        where: inArray(job_matches.id, ids.map((r) => r.id)),
        orderBy: desc(job_matches.score),
        with: {
          job: {
            columns: {
              id: true,
              title: true,
              company: true,
              office_location: true,
              source_url: true,
              job_description: true,
              salary_min: true,
              salary_max: true,
              salary_currency: true,
              salary_period: true,
              skills_required: true,
              work_location: true,
              job_types: true,
              experience_levels: true,
              date_posted: true,
              date_created: true,
            },
            with: {
              job_platform: { columns: { id: true, name: true } },
            },
          },
        },
      });
    }),

    // Skill levels for match card highlighting
    getProfileSkillLevels(profileId),

    // Active applications
    db.query.applications.findMany({
      where: and(eq(applications.profile_id, profileId), inArray(applications.status, activeApplicationStatuses)),
      with: {
        job: {
          with: {
            job_platform: true,
          },
        },
      },
      orderBy: desc(applications.date_updated),
    }),
  ]);

  // Process match stats — total from shared getMatchCounts (same as Match Progress page)
  const curationStats = curationStatsRaw[0];
  const strong80 = Number(curationStats?.strong80 ?? 0);
  const strong70 = Number(curationStats?.strong70 ?? 0);
  // Prefer 80+ threshold, fall back to 70+ if fewer than 3 strong matches at 80+
  const useHighThreshold = strong80 >= 3;
  const matchStats = {
    total: sharedMatchCounts.matchedCount,
    strong: useHighThreshold ? strong80 : strong70,
    strongThreshold: useHighThreshold ? 80 : 70,
    saved: Number(curationStats?.saved ?? 0),
    newUnreviewed: Number(curationStats?.new_unreviewed ?? 0),
  };

  // Compute profile completeness
  const totalSkills =
    profileData?.tech_skill_categories?.reduce(
      (sum, cat) => sum + cat.tech_skills.length,
      0,
    ) ?? 0;

  const hasWorkExperience = (profileData?.work_experiences?.length ?? 0) > 0;
  const hasEducation = (profileData?.educations?.length ?? 0) > 0;

  const profileCompleteness = {
    hasSkills: totalSkills > 0,
    skillCount: totalSkills,
    hasMatchConfig: matchConfig != null
      && ((matchConfig.job_types as string[]) ?? []).length > 0
      && ((matchConfig.work_location as string[]) ?? []).length > 0,
    hasWorkExperience,
    hasEducation,
    hasExperienceOrEducation: hasWorkExperience || hasEducation,
    hasTitle: !!profileData?.title,
    hasHeadline: !!profileData?.headline,
    hasLocation: !!(profileData?.city && profileData?.country_code),
  };

  // Process search tasks
  const searchTasks = {
    tasks: searchTasksList,
    totalCount: searchTasksList.length,
    activeCount: searchTasksList.filter((s) => s.is_active).length,
    lastRun: searchTasksList.find((s) => s.last_run)?.last_run ?? null,
    totalJobsFound: searchTasksList.reduce(
      (sum, s) => sum + (s.last_run_jobs_found ?? 0),
      0,
    ),
  };

  // Process top matches (filter out matches where the job was deleted)
  const topMatches = topMatchesRaw
    .filter((m) => m.job != null)
    .map((m) => ({
      id: m.id,
      score: m.score,
      match_summary: m.match_summary,
      matched_skills: m.matched_skills,
      skill_match_percentage: m.skill_match_percentage,
      job: m.job!,
    }));

  return {
    profileCompleteness,
    matchConfig,
    searchTasks,
    matchStats,
    topMatches,
    profileSkillLevels,
    activeApplications,
  };
};

function parseJobId(formData: FormData) {
  const jobId = parseInt(formData.get("jobId") as string);
  if (isNaN(jobId)) return null;
  return jobId;
}

async function getAuthProfileId(
  locals: App.Locals,
  cookies: import("@sveltejs/kit").Cookies,
) {
  const user = locals.user;
  if (!user) return null;
  return getSelectedProfileId(cookies, user.id);
}

export const actions: Actions = {
  saveJob: async ({ request, locals, cookies }) => {
    const profileId = await getAuthProfileId(locals, cookies);
    if (!profileId) return fail(401, { error: "Not authenticated" });
    const jobId = parseJobId(await request.formData());
    if (!jobId) return fail(400, { error: "Invalid job ID" });
    return saveJob(profileId, jobId);
  },

  unsaveJob: async ({ request, locals, cookies }) => {
    const profileId = await getAuthProfileId(locals, cookies);
    if (!profileId) return fail(401, { error: "Not authenticated" });
    const jobId = parseJobId(await request.formData());
    if (!jobId) return fail(400, { error: "Invalid job ID" });
    return unsaveJob(profileId, jobId);
  },

  rejectJob: async ({ request, locals, cookies }) => {
    const profileId = await getAuthProfileId(locals, cookies);
    if (!profileId) return fail(401, { error: "Not authenticated" });
    const jobId = parseJobId(await request.formData());
    if (!jobId) return fail(400, { error: "Invalid job ID" });
    return rejectJob(profileId, jobId);
  },

  unrejectJob: async ({ request, locals, cookies }) => {
    const profileId = await getAuthProfileId(locals, cookies);
    if (!profileId) return fail(401, { error: "Not authenticated" });
    const jobId = parseJobId(await request.formData());
    if (!jobId) return fail(400, { error: "Invalid job ID" });
    return unrejectJob(profileId, jobId);
  },
};
