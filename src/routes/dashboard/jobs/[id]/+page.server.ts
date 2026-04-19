import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { dbDirect as db, queryRaw, sql } from "$lib/server/db";
import { eq, and, isNotNull, desc, asc } from "drizzle-orm";
import { jobs as jobsTable, job_matches, job_statuses, search_task_run_items, job_importers, job_match_history, platform_profiles, search_tasks, profiles, applications, application_status_log } from "$lib/server/db/schema";
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
  const job = await db.query.jobs.findFirst({
    where: eq(jobsTable.id, jobId),
    with: {
      job_platform: {
        columns: {
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
  const match = await db.query.job_matches.findFirst({
    where: and(eq(job_matches.profile_id, profileId), eq(job_matches.job_id, jobId)),
  });

  // Get user status from job_statuses table
  const jobStatus = await db.query.job_statuses.findFirst({
    where: and(eq(job_statuses.profile, profileId), eq(job_statuses.job, jobId)),
    columns: { status: true },
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
    scrapeHistory = await db.query.search_task_run_items.findMany({
      where: and(eq(search_task_run_items.job_id, jobId), isNotNull(search_task_run_items.processed_at)),
      columns: { processed_at: true },
      orderBy: desc(search_task_run_items.processed_at),
    }) as { processed_at: Date }[];
  }

  // Load importers (which profiles scraped/imported this job) for staff
  let importers: { profileName: string; scrapedAt: Date | null }[] = [];
  if (isStaff) {
    // Get profiles that scraped this job (via search task run items → search task → profile)
    const scrapeImporters = await db.query.search_task_run_items.findMany({
      where: eq(search_task_run_items.job_id, jobId),
      columns: {
        processed_at: true,
      },
      with: {
        search_task_run: {
          columns: {},
          with: {
            search_task: {
              columns: {},
              with: {
                profile: { columns: { name: true } },
              },
            },
          },
        },
      },
      orderBy: asc(search_task_run_items.processed_at),
    });

    // Also get profiles from job_importers (in case of manual imports without a scrape run)
    const jobImporterRows = await db.query.job_importers.findMany({
      where: eq(job_importers.job, jobId),
      columns: {
        date_created: true,
      },
      with: {
        profile: { columns: { name: true } },
      },
    });

    // Merge both sources, deduplicate by profile name, keep earliest date
    const seen = new Map<string, Date | null>();
    for (const sri of scrapeImporters) {
      const name = sri.search_task_run?.search_task?.profile?.name || "Unknown";
      if (!seen.has(name)) seen.set(name, sri.processed_at);
    }
    for (const imp of jobImporterRows) {
      const name = imp.profile?.name || "Unknown";
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
    matchHistory = await db.query.job_match_history.findMany({
      where: and(eq(job_match_history.job, jobId), eq(job_match_history.profile, profileId)),
      columns: {
        score: true,
        skill_match_percentage: true,
        recommendation: true,
        match_summary: true,
        date_created: true,
      },
      orderBy: desc(job_match_history.date_created),
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
    const platformCredentials = await db.query.platform_profiles.findMany({
      where: and(eq(platform_profiles.profile_id, profileId), eq(platform_profiles.platform_id, job.job_platform_id)),
      columns: { id: true, username: true },
    });

    // Fetch job search settings for this platform + profile
    const searchTask = await db.query.search_tasks.findFirst({
      where: and(eq(search_tasks.platform_id, job.job_platform_id), eq(search_tasks.profile_id, profileId)),
      columns: {
        browser_provider: true,
        keep_minimized: true,
        platform_profile_id: true,
      },
      with: {
        job_platform: { columns: { login_page_url: true } },
      },
    });

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.id, profileId),
      columns: {
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
      loginUrl: searchTask?.job_platform?.login_page_url ?? null,
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
  const existingApplication = await db.query.applications.findFirst({
    where: and(eq(applications.job_id, jobId), eq(applications.profile_id, profileId)),
    columns: { id: true, status: true },
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

    const job = await db.query.jobs.findFirst({ where: eq(jobsTable.id, jobId) });
    if (!job) {
      return fail(404, { error: "Job not found" });
    }

    const now = new Date();
    await queryRaw(sql`
      INSERT INTO job_statuses (profile, job, status, date_created, date_updated)
      VALUES (${profileId}, ${jobId}, 'saved', ${now}, ${now})
      ON CONFLICT (profile, job)
      DO UPDATE SET status = 'saved', date_updated = ${now}
    `);

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

    await db.delete(job_statuses).where(and(eq(job_statuses.profile, profileId), eq(job_statuses.job, jobId)));

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
      await db.delete(job_statuses).where(and(eq(job_statuses.profile, profileId), eq(job_statuses.job, jobId)));
    } else {
      const now = new Date();
      await queryRaw(sql`
        INSERT INTO job_statuses (profile, job, status, date_created, date_updated)
        VALUES (${profileId}, ${jobId}, ${status}, ${now}, ${now})
        ON CONFLICT (profile, job)
        DO UPDATE SET status = ${status}, date_updated = ${now}
      `);
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
    const existing = await db.query.applications.findFirst({
      where: and(eq(applications.job_id, jobId), eq(applications.profile_id, profileId)),
      columns: { id: true },
    });

    if (existing) {
      redirect(302, `/dashboard/applications/${existing.id}`);
    }

    // Create new application
    const now = new Date();
    const [application] = await db.insert(applications).values({
      job_id: jobId,
      profile_id: profileId,
      status: "preparing",
      status_action: "Send application",
      date_created: now,
      date_updated: now,
      application_seen_date: now,
    }).returning();

    // Create initial status log entry
    await db.insert(application_status_log).values({
      application: application.id,
      date_created: now,
      from_status: null,
      to_status: "preparing",
      description: "Application created",
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
