import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getProfileSkillLevels } from "$lib/server/job/match-utils";
import { addMatchJob } from "$lib/server/queue/match-queue";
import { getSelectedProfileId } from "../../profile/utils";
import { getGeoConfig } from "$lib/server/browser/geo-utils";

export const load: PageServerLoad = async ({ parent, params }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const profileId = layoutData.selectedProfile.id;
  const jobId = parseInt(params.id);

  if (isNaN(jobId)) {
    error(400, "Invalid job ID");
  }

  // Get job with platform info
  const job = await db.jobs.findUnique({
    where: { id: jobId },
    include: {
      job_platforms: {
        select: {
          id: true,
          name: true,
          url: true,
        },
      },
    },
  });

  if (!job) {
    error(404, "Job not found");
  }

  // Get match info if exists
  const match = await db.job_matches.findFirst({
    where: {
      profile_id: profileId,
      job_id: jobId,
    },
  });

  // Get user status from job_statuses table
  const jobStatus = await db.job_statuses.findFirst({
    where: { profile: profileId, job: jobId },
    select: { status: true },
  });

  // Determine job category for sidebar highlighting
  const jobCategory = jobStatus?.status === "saved"
    ? "saved"
    : match && match.score > 0
    ? "matches"
    : "all";

  // Load user's skill proficiency levels for highlighting
  const profileSkillLevels = await getProfileSkillLevels(profileId);

  // Check staff status
  const user = layoutData.user;
  const isStaff = !!(user as { is_staff?: boolean })?.is_staff ||
    !!(user as { is_admin?: boolean })?.is_admin;

  // Load scrape history for staff (only if scraped more than once)
  let scrapeHistory: { processed_at: Date }[] = [];
  if (isStaff && job.scrape_count && job.scrape_count > 1) {
    scrapeHistory = await db.search_task_run_items.findMany({
      where: {
        job_id: jobId,
        processed_at: { not: null },
      },
      select: { processed_at: true },
      orderBy: { processed_at: "desc" },
    }) as { processed_at: Date }[];
  }

  // Load importers (which profiles scraped/imported this job) for staff
  let importers: { profileName: string; scrapedAt: Date | null }[] = [];
  if (isStaff) {
    // Get profiles that scraped this job (via search task run items → search task → profile)
    const scrapeImporters = await db.search_task_run_items.findMany({
      where: { job_id: jobId },
      select: {
        processed_at: true,
        search_task_runs: {
          select: {
            search_tasks: {
              select: {
                profiles: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { processed_at: "asc" },
    });

    // Also get profiles from job_importers (in case of manual imports without a scrape run)
    const jobImporters = await db.job_importers.findMany({
      where: { job: jobId },
      select: {
        date_created: true,
        profiles: { select: { name: true } },
      },
    });

    // Merge both sources, deduplicate by profile name, keep earliest date
    const seen = new Map<string, Date | null>();
    for (const sri of scrapeImporters) {
      const name = sri.search_task_runs?.search_tasks?.profiles?.name || "Unknown";
      if (!seen.has(name)) seen.set(name, sri.processed_at);
    }
    for (const imp of jobImporters) {
      const name = imp.profiles?.name || "Unknown";
      if (!seen.has(name)) seen.set(name, imp.date_created);
    }
    importers = Array.from(seen.entries()).map(([profileName, scrapedAt]) => ({
      profileName,
      scrapedAt,
    }));
  }

  // Load match history for staff
  let matchHistory: {
    score: number;
    skill_match_percentage: number | null;
    recommendation: string | null;
    match_summary: string | null;
    date_created: Date | null;
  }[] = [];
  if (isStaff) {
    matchHistory = await db.job_match_history.findMany({
      where: { job: jobId, profile: profileId },
      select: {
        score: true,
        skill_match_percentage: true,
        recommendation: true,
        match_summary: true,
        date_created: true,
      },
      orderBy: { date_created: "desc" },
    });
  }

  // Load rescrape config data: credentials, country, browser fingerprint, browser provider, etc.
  let rescrapeConfig: {
    platformCredentials: { id: number; username: string | null }[];
    platformId: number;
    selectedCredentialId: string;
    loginUrl: string | null;
    browserProvider: string | null;
    keepMinimized: boolean;
    defaultCountryCode: string;
    browserFingerprint: {
      language: string;
      timezone: string;
      userAgent: string;
    };
    browserFingerprintDefaults: { language: string; timezone: string };
  } | null = null;
  if (isStaff && job.job_platform_id) {
    // Fetch all credentials for this platform
    const platformCredentials = await db.platform_profiles.findMany({
      where: { profile_id: profileId, platform_id: job.job_platform_id },
      select: { id: true, username: true },
    });

    // Fetch job search settings for this platform + profile
    const searchTask = await db.search_tasks.findFirst({
      where: { platform_id: job.job_platform_id, profile_id: profileId },
      select: {
        browser_provider: true,
        keep_minimized: true,
        platform_profile_id: true,
        job_platforms: { select: { login_page_url: true } },
      },
    });

    const profile = await db.profiles.findUnique({
      where: { id: profileId },
      select: {
        country_code: true,
        browser_language: true,
        browser_timezone: true,
      },
    });

    const defaultCountryCode = profile?.country_code || "";
    const geoDefaults = getGeoConfig(defaultCountryCode || "US");

    rescrapeConfig = {
      platformCredentials,
      platformId: job.job_platform_id,
      selectedCredentialId: searchTask?.platform_profile_id?.toString() ??
        "none",
      loginUrl: searchTask?.job_platforms?.login_page_url ?? null,
      browserProvider: (searchTask as any)?.browser_provider ?? null,
      keepMinimized: (searchTask as any)?.keep_minimized ?? true,
      defaultCountryCode,
      browserFingerprint: {
        language: profile?.browser_language || "",
        timezone: profile?.browser_timezone || "",
      },
      browserFingerprintDefaults: {
        language: geoDefaults.language,
        timezone: geoDefaults.timezone,
      },
    };
  }

  // Check if there's an existing application for this job
  const existingApplication = await db.applications.findFirst({
    where: { job_id: jobId, profile_id: profileId },
    select: { id: true, status: true },
  });

  return {
    job,
    match,
    jobStatus: jobStatus?.status ?? "new",
    profileId,
    jobCategory,
    profileSkillLevels,
    isStaff,
    scrapeHistory,
    importers,
    matchHistory,
    rescrapeConfig,
    existingApplication,
  };
};

export const actions: Actions = {
  saveJob: async ({ locals, cookies, params }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const jobId = parseInt(params.id);
    if (isNaN(jobId)) {
      return fail(400, { error: "Invalid job ID" });
    }

    const job = await db.jobs.findUnique({ where: { id: jobId } });
    if (!job) {
      return fail(404, { error: "Job not found" });
    }

    const now = new Date();
    await db.$queryRaw`
      INSERT INTO job_statuses (profile, job, status, date_created, date_updated)
      VALUES (${profileId}, ${jobId}, 'saved', ${now}, ${now})
      ON CONFLICT (profile, job)
      DO UPDATE SET status = 'saved', date_updated = ${now}
    `;

    return { success: true, action: "saved" };
  },

  unsaveJob: async ({ locals, cookies, params }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const jobId = parseInt(params.id);
    if (isNaN(jobId)) {
      return fail(400, { error: "Invalid job ID" });
    }

    await db.job_statuses.deleteMany({
      where: { profile: profileId, job: jobId },
    });

    return { success: true, action: "unsaved" };
  },

  updateStatus: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const jobId = parseInt(params.id);
    if (isNaN(jobId)) {
      return fail(400, { error: "Invalid job ID" });
    }

    const formData = await request.formData();
    const status = formData.get("status") as string;

    if (status === "new") {
      // "new" means remove the status row
      await db.job_statuses.deleteMany({
        where: { profile: profileId, job: jobId },
      });
    } else {
      const now = new Date();
      await db.$queryRaw`
        INSERT INTO job_statuses (profile, job, status, date_created, date_updated)
        VALUES (${profileId}, ${jobId}, ${status}, ${now}, ${now})
        ON CONFLICT (profile, job)
        DO UPDATE SET status = ${status}, date_updated = ${now}
      `;
    }

    return { success: true, status };
  },

  startApplication: async ({ locals, cookies, params }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const jobId = parseInt(params.id);
    if (isNaN(jobId)) {
      return fail(400, { error: "Invalid job ID" });
    }

    // Check if application already exists
    const existing = await db.applications.findFirst({
      where: { job_id: jobId, profile_id: profileId },
      select: { id: true },
    });

    if (existing) {
      redirect(302, `/dashboard/applications/${existing.id}`);
    }

    // Create new application
    const now = new Date();
    const application = await db.applications.create({
      data: {
        job_id: jobId,
        profile_id: profileId,
        status: "preparing",
        status_action: "Send application",
        date_created: now,
        date_updated: now,
        application_seen_date: now,
      },
    });

    // Create initial status log entry
    await db.application_status_log.create({
      data: {
        application: application.id,
        date_created: now,
        from_status: null,
        to_status: "preparing",
        description: "Application created",
      },
    });

    redirect(302, `/dashboard/applications/${application.id}`);
  },

  rematchJob: async ({ locals, cookies, params }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    // Staff-only action
    const isStaff = !!(user as { is_staff?: boolean }).is_staff ||
      !!(user as { is_admin?: boolean }).is_admin;
    if (!isStaff) {
      return fail(403, { error: "Staff access required" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const jobId = parseInt(params.id);
    if (isNaN(jobId)) {
      return fail(400, { error: "Invalid job ID" });
    }

    // Enqueue a match job for the cloud worker and wait for result
    try {
      const result = await addMatchJob({
        profileId,
        jobId,
        triggeredBy: "user",
      });
      return { success: true, action: "rematched", score: result.score };
    } catch (err) {
      return fail(500, {
        error: `Re-match failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
    }
  },
};
