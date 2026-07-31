import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { dbDirect as db, queryRaw, sql } from "$lib/server/db";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import {
  application_status_log,
  applications,
  job_importers,
  job_match_history,
  job_matches,
  job_statuses,
  jobs as jobsTable,
  platform_credentials,
  profiles,
  search_task_run_items,
  search_tasks,
} from "$lib/server/db/schema";
import { getProfileSkillLevels } from "$lib/server/job/match-utils";
import { addMatchJob } from "$lib/server/queue/match-queue";
import { getSelectedProfileId } from "../../profile/utils";
import { getGeoConfig } from "$lib/server/browser/geo-utils";
import { parseJobDescription } from "$lib/server/jobs/parse-job-description";
import { classifyRegion } from "$lib/data/job-taxonomy";
import {
  normalizeExperienceLevels,
  normalizeJobType,
  normalizeWorkLocation,
} from "$lib/data/job-normalize";
import { normalizeSalaryPeriod } from "$lib/salary/conversion";

/**
 * How long the inline re-score may block the form action. Shorter than
 * addMatchJob's own 60s default: the re-parse LLM call has already run by this
 * point, and a request that hangs for two minutes is worse for the user than a
 * score that lands a cycle later.
 */
const RESCORE_TIMEOUT_MS = 45_000;

/** Matches the `jobs.title` varchar width — a longer value errors at the DB. */
const TITLE_MAX_LENGTH = 255;

/**
 * Re-extract parser-owned fields from a job's stored content and re-score it.
 *
 * Shared by the staff "Re-parse" action and the "Save & re-parse" description
 * edit. Returns a discriminated result so callers can map failures onto the
 * right HTTP status.
 */
async function reparseAndRescore(
  jobId: number,
  profileId: number,
): Promise<
  { ok: true; title: string | null } | {
    ok: false;
    status: number;
    error: string;
  }
> {
  const job = await db.query.jobs.findFirst({
    where: eq(jobsTable.id, jobId),
    columns: {
      source_html_stripped: true,
      job_description: true,
      source_url: true,
      title: true,
      company: true,
    },
  });
  if (!job) return { ok: false, status: 404, error: "Job not found" };

  // Re-extract from already-stored content — captured HTML preferred, else the
  // description text. No re-fetch (unlike Rescrape), so this also works for
  // manual jobs that have no source_url.
  const text = job.source_html_stripped ?? job.job_description;
  if (!text || text.trim() === "") {
    return {
      ok: false,
      status: 400,
      error: "No stored content to re-parse (no captured HTML or description)",
    };
  }

  const parsed = await parseJobDescription(text, {
    profileId,
    sourceUrl: job.source_url,
  });
  if (!parsed) {
    return {
      ok: false,
      status: 502,
      error: "Re-parse failed — the extraction LLM returned no result",
    };
  }

  // Wholesale re-extraction: overwrite parser-owned fields. Title/company are
  // coalesced to the existing values so a partial extraction can't wipe the
  // job's identity. Description text and source_html_stripped stay as the
  // stable parse input; status/source_url/platform are lifecycle fields a
  // re-parse shouldn't touch.
  const rawLocation = parsed.location ?? null;
  const effectiveLocation = rawLocation && normalizeWorkLocation(rawLocation)
    ? null
    : rawLocation;

  await db.update(jobsTable)
    .set({
      title: parsed.title ?? job.title,
      company: parsed.company ?? job.company,
      company_description: parsed.company_description,
      job_poster: parsed.job_poster,
      office_location: effectiveLocation,
      region: classifyRegion(effectiveLocation),
      salary_min: parsed.salary_min,
      salary_max: parsed.salary_max,
      salary_currency: parsed.salary_currency,
      salary_period: normalizeSalaryPeriod(parsed.salary_period) ||
        parsed.salary_period,
      salary_duration_weeks: parsed.salary_duration_weeks,
      work_location: normalizeWorkLocation(parsed.remote),
      job_types: normalizeJobType(parsed.job_type),
      experience_levels: normalizeExperienceLevels(parsed.experience_levels),
      skills_required: parsed.skills_required,
      skills_preferred: parsed.skills_preferred,
      responsibilities: parsed.responsibilities,
      soft_skills: parsed.soft_skills,
      // date_posted is a Drizzle date() column (string mode).
      date_posted: parsed.date_posted
        ? parsed.date_posted.toISOString().split("T")[0]
        : null,
      ai_chat_extraction: parsed.ai_chat_extraction,
      date_updated: new Date(),
    })
    .where(eq(jobsTable.id, jobId));

  // Skills likely changed, so every profile's score for this job is stale.
  // Mirror the scraper: flag all matches for the job as needing a re-score,
  // then enqueue a fresh score for the acting profile (non-blocking; other
  // profiles recompute via the background matcher). Flagging rather than
  // deleting keeps the old score visible until the new one lands.
  await db.update(job_matches)
    .set({ rescore_requested_at: new Date() })
    .where(eq(job_matches.job_id, jobId));

  // Score the acting profile inline, so the page reload that follows shows the
  // new number — that is what the button promises. triggerMatchForImport is no
  // use here: it skips jobs that already have a match row, which since we flag
  // instead of delete is all of them.
  //
  // Failing is not fatal. The flag stays set either way, so the background
  // matcher picks the job up on its next cycle and the score arrives late
  // rather than never — the same path the other profiles' rows take.
  try {
    await addMatchJob(
      { profileId, jobId, triggeredBy: "user" },
      RESCORE_TIMEOUT_MS,
    );
  } catch (err) {
    console.warn(
      `[reparse] inline re-score failed for profile=${profileId} job=${jobId}, ` +
        `leaving it to the background matcher:`,
      err,
    );
  }

  return { ok: true, title: parsed.title ?? job.title };
}

/**
 * Whether `profileId` may hand-edit this job's title and description.
 *
 * Jobs are shared across profiles, so editing is limited to manually-created
 * ones — a scraped job's content is a page capture that the next rescrape
 * would overwrite anyway. Within those, only the profile that created the job
 * (its importer) or staff can edit.
 */
async function canEditJobContent(
  jobId: number,
  profileId: number,
  createdManually: boolean,
  isStaff: boolean,
): Promise<boolean> {
  if (!createdManually) return false;
  if (isStaff) return true;

  const importer = await db.query.job_importers.findFirst({
    where: and(
      eq(job_importers.job_id, jobId),
      eq(job_importers.profile_id, profileId),
    ),
    columns: { job_id: true },
  });
  return !!importer;
}

export const load: PageServerLoad = async ({ parent, params }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
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
    where: and(
      eq(job_matches.profile_id, profileId),
      eq(job_matches.job_id, jobId),
    ),
  });

  // Get user status from job_statuses table
  const jobStatus = await db.query.job_statuses.findFirst({
    where: and(
      eq(job_statuses.profile_id, profileId),
      eq(job_statuses.job_id, jobId),
    ),
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

  const canEditContent = await canEditJobContent(
    jobId,
    profileId,
    job.created_manually,
    isStaff,
  );

  // Load scrape history for staff (only if scraped more than once)
  let scrapeHistory: { processed_at: Date }[] = [];
  if (isStaff && job.scrape_count && job.scrape_count > 1) {
    scrapeHistory = await db.query.search_task_run_items.findMany({
      where: and(
        eq(search_task_run_items.job_id, jobId),
        isNotNull(search_task_run_items.processed_at),
      ),
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
      where: eq(job_importers.job_id, jobId),
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
      where: and(
        eq(job_match_history.job_id, jobId),
        eq(job_match_history.profile_id, profileId),
      ),
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
    // Resolve the user owning this profile, then list their user-wide
    // credentials for this platform — the rescrape picker lets staff
    // choose any of the owner's logins.
    const ownerProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, profileId),
      columns: { user_id: true },
    });
    const platformCredentials = ownerProfile
      ? await db.query.platform_credentials.findMany({
        where: and(
          eq(platform_credentials.user_id, ownerProfile.user_id),
          eq(platform_credentials.platform_id, job.job_platform_id),
        ),
        columns: { id: true, username: true },
      })
      : [];

    // Fetch job search settings for this platform + profile. Resolves the
    // credential id via the platform_profiles binding so the rescrape picker
    // can pre-select the right credential.
    const searchTask = await db.query.search_tasks.findFirst({
      where: and(
        eq(search_tasks.platform_id, job.job_platform_id),
        eq(search_tasks.profile_id, profileId),
      ),
      columns: {
        browser_provider: true,
        keep_minimized: true,
      },
      with: {
        job_platform: { columns: { login_page_url: true } },
        platform_profile: { columns: { platform_credential_id: true } },
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
      selectedCredentialId:
        searchTask?.platform_profile?.platform_credential_id?.toString() ??
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
    where: and(
      eq(applications.job_id, jobId),
      eq(applications.profile_id, profileId),
    ),
    columns: { id: true, status: true },
  });

  // Label for the assistant's "I can see this page" chip. The job itself is
  // resolved server-side from the route — see ai-chat/chat-context.ts.
  const chatContext = {
    label: `Job: ${job.title ?? "Untitled"}${
      job.company ? ` at ${job.company}` : ""
    }`,
  };

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
    chatContext,
    canEditContent,
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

    const job = await db.query.jobs.findFirst({
      where: eq(jobsTable.id, jobId),
    });
    if (!job) {
      return fail(404, { error: "Job not found" });
    }

    const now = new Date();
    await queryRaw(sql`
      INSERT INTO job_statuses (profile_id, job_id, status, date_created, date_updated)
      VALUES (${profileId}, ${jobId}, 'saved', ${now}, ${now})
      ON CONFLICT (profile_id, job_id)
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

    await db.delete(job_statuses).where(
      and(
        eq(job_statuses.profile_id, profileId),
        eq(job_statuses.job_id, jobId),
      ),
    );

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
      await db.delete(job_statuses).where(
        and(
          eq(job_statuses.profile_id, profileId),
          eq(job_statuses.job_id, jobId),
        ),
      );
    } else {
      const now = new Date();
      await queryRaw(sql`
        INSERT INTO job_statuses (profile_id, job_id, status, date_created, date_updated)
        VALUES (${profileId}, ${jobId}, ${status}, ${now}, ${now})
        ON CONFLICT (profile_id, job_id)
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
      where: and(
        eq(applications.job_id, jobId),
        eq(applications.profile_id, profileId),
      ),
      columns: { id: true },
    });

    if (existing) {
      redirect(302, `/applications/${existing.id}`);
    }

    // Create new application
    const now = new Date();
    const [application] = await db.insert(applications).values({
      job_id: jobId,
      profile_id: profileId,
      status: "applying",
      status_step: "Preparing",
      status_action: "Send application",
      date_created: now,
      date_updated: now,
      // application_seen_date is a Drizzle date() column (string mode).
      application_seen_date: now.toISOString().split("T")[0],
    }).returning();

    // Create initial status log entry
    await db.insert(application_status_log).values({
      application: application.id,
      date_created: now,
      from_status: null,
      to_status: "applying",
      step: "Preparing",
      action: "Send application",
    });

    redirect(302, `/applications/${application.id}`);
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

  reparseJob: async ({ locals, cookies, params }) => {
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

    // Seeds the extraction prompt's profile context; matching is enqueued for
    // this profile below.
    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const jobId = parseInt(params.id);
    if (isNaN(jobId)) {
      return fail(400, { error: "Invalid job ID" });
    }

    const result = await reparseAndRescore(jobId, profileId);
    if (!result.ok) {
      return fail(result.status, { error: result.error });
    }

    return { success: true, action: "reparsed", title: result.title };
  },

  /**
   * Hand-edit a manually-created job's title.
   *
   * No re-parse variant, unlike the description: the title is parser *output*,
   * not input, so a hand-set title stands until the next "Save & re-parse"
   * overwrites it from the description text.
   */
  updateTitle: async ({ request, locals, cookies, params }) => {
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

    const job = await db.query.jobs.findFirst({
      where: eq(jobsTable.id, jobId),
      columns: { created_manually: true },
    });
    if (!job) {
      return fail(404, { error: "Job not found" });
    }

    const isStaff = !!(user as { is_staff?: boolean }).is_staff ||
      !!(user as { is_admin?: boolean }).is_admin;
    const allowed = await canEditJobContent(
      jobId,
      profileId,
      job.created_manually,
      isStaff,
    );
    if (!allowed) {
      return fail(403, { error: "This job's title can't be edited" });
    }

    const formData = await request.formData();
    const title = ((formData.get("title") as string) ?? "").trim();

    if (!title) {
      return fail(400, { error: "Title cannot be empty" });
    }
    if (title.length > TITLE_MAX_LENGTH) {
      return fail(400, {
        error: `Title cannot be longer than ${TITLE_MAX_LENGTH} characters`,
      });
    }

    await db.update(jobsTable)
      .set({ title, date_updated: new Date() })
      .where(eq(jobsTable.id, jobId));

    return { success: true, action: "titleSaved", title };
  },

  /**
   * Hand-edit a manually-created job's description, optionally re-running
   * extraction + scoring on the new text.
   */
  updateDescription: async ({ request, locals, cookies, params }) => {
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

    const job = await db.query.jobs.findFirst({
      where: eq(jobsTable.id, jobId),
      columns: { created_manually: true },
    });
    if (!job) {
      return fail(404, { error: "Job not found" });
    }

    const isStaff = !!(user as { is_staff?: boolean }).is_staff ||
      !!(user as { is_admin?: boolean }).is_admin;
    const allowed = await canEditJobContent(
      jobId,
      profileId,
      job.created_manually,
      isStaff,
    );
    if (!allowed) {
      return fail(403, { error: "This job's description can't be edited" });
    }

    const formData = await request.formData();
    const description = ((formData.get("description") as string) ?? "").trim();
    const reparse = formData.get("reparse") === "1";

    if (!description) {
      return fail(400, { error: "Description cannot be empty" });
    }

    // The edited text becomes the canonical content: mirror it into
    // source_html_stripped, which re-parse reads in preference to the
    // description. Without this the parser would re-read the stale capture and
    // the edit would silently have no effect.
    await db.update(jobsTable)
      .set({
        job_description: description,
        source_html_stripped: description,
        date_updated: new Date(),
      })
      .where(eq(jobsTable.id, jobId));

    if (!reparse) {
      return { success: true, action: "descriptionSaved", description };
    }

    const result = await reparseAndRescore(jobId, profileId);
    if (!result.ok) {
      // The description edit is already committed — report the re-parse
      // failure separately rather than pretending the save failed too.
      return fail(result.status, {
        error: `Description saved, but re-parse failed: ${result.error}`,
      });
    }

    return {
      success: true,
      action: "descriptionReparsed",
      title: result.title,
    };
  },

  archiveJob: async ({ locals, params }) => {
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

    const jobId = parseInt(params.id);
    if (isNaN(jobId)) {
      return fail(400, { error: "Invalid job ID" });
    }

    const job = await db.query.jobs.findFirst({
      where: eq(jobsTable.id, jobId),
      columns: { status: true },
    });
    if (!job) {
      return fail(404, { error: "Job not found" });
    }

    // Toggle: archived jobs are hidden from match counts/listings; restoring
    // returns the job to "published" (original status isn't tracked separately).
    const newStatus = job.status === "archived" ? "published" : "archived";
    await db.update(jobsTable)
      .set({ status: newStatus, date_updated: new Date() })
      .where(eq(jobsTable.id, jobId));

    return { success: true, action: "archived", status: newStatus };
  },

  deleteJob: async ({ locals, params }) => {
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

    const jobId = parseInt(params.id);
    if (isNaN(jobId)) {
      return fail(400, { error: "Invalid job ID" });
    }

    // FK constraints on jobs cascade (matches/statuses/history/resources/
    // importers) or set null (applications/search_task_run_items), so a hard
    // delete is safe without manual cleanup.
    await db.delete(jobsTable).where(eq(jobsTable.id, jobId));

    redirect(302, "/jobs");
  },
};
