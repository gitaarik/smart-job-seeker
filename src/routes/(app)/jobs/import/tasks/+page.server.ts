import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, or, like, desc } from "drizzle-orm";
import { search_tasks, profiles, job_platforms, platform_profiles } from "$lib/server/db/schema";
import { config } from "$lib/server/config";
import { getSelectedProfileId } from "../../../profile/utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }

  const profileId = layoutData.selectedProfile.id;

  const [searchTasksList, profile] = await Promise.all([
    db.query.search_tasks.findMany({
      where: eq(search_tasks.profile_id, profileId),
      with: {
        job_platform: true,
        platform_profile: true,
      },
      orderBy: desc(search_tasks.date_created),
    }),
    (async () => {
      const p = await db.query.profiles.findFirst({
        where: eq(profiles.id, profileId),
        columns: { ui_preferences: true, browser_country_code: true, country_code: true },
      });
      if (!p) throw new Error("Record not found");
      return p;
    })(),
  ]);
  const searchTasks = searchTasksList;

  const uiPrefs = (profile.ui_preferences as Record<string, unknown>) ?? {};

  return {
    searchTasks,
    profileId,
    searchTaskSort: (uiPrefs.searchTaskSort as string) ?? "added",
    localBrowserAllowed: config.localBrowserAllowed,
    serverBrowserProvider: config.browserProvider,
    defaultBrowserProvider: config.defaultBrowserProvider,
    defaultMaxJobs: config.defaultMaxJobs,
    browserCountryCode: profile.browser_country_code ?? "",
    defaultCountryCode: profile.country_code ?? "",
  };
};

async function getOrCreatePlatform(
  platformId: string | null,
  platformUrl: string | null,
  platformName: string | null,
  isNew: boolean,
  loginPageUrl: string | null = null,
): Promise<number | null> {
  if (!platformUrl) return null;

  // If we have an existing platform ID and it's not new, update login_page_url if provided
  if (platformId && !isNew) {
    if (loginPageUrl !== null) {
      await db.update(job_platforms).set({ login_page_url: loginPageUrl || null }).where(eq(job_platforms.id, parseInt(platformId)));
    }
    return parseInt(platformId);
  }

  // Try to find existing platform by URL
  const parsed = new URL(platformUrl);
  const domain = parsed.hostname.replace(/^www\./, "");

  const existing = await db.query.job_platforms.findFirst({
    where: or(
      like(job_platforms.url, `%${domain}%`),
      like(job_platforms.key, `%${domain.split(".")[0]}%`),
    ),
  });

  if (existing) {
    return existing.id;
  }

  // Create new platform
  const key = domain
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase();

  const [platform] = await db.insert(job_platforms).values({
    name: platformName || domain,
    url: platformUrl,
    key: `${key}-${Date.now().toString(36)}`, // Ensure unique key
    login_page_url: loginPageUrl || null,
    status: "published",
    date_created: new Date(),
  }).returning();

  return platform.id;
}

async function getOrCreateCredentials(
  profileId: number,
  platformId: number,
  credentialId: string | null,
  newUsername: string | null,
  newPassword: string | null,
  newSecurityAnswer: string | null = null,
): Promise<number | null> {
  // If using existing credentials
  if (credentialId && credentialId !== "none" && credentialId !== "new") {
    const existing = await db.query.platform_profiles.findFirst({
      where: and(eq(platform_profiles.id, parseInt(credentialId)), eq(platform_profiles.profile_id, profileId), eq(platform_profiles.platform_id, platformId)),
    });
    if (existing) {
      return existing.id;
    }
  }

  // If adding new credentials
  if (credentialId === "new" && newUsername) {
    const [newCred] = await db.insert(platform_profiles).values({
      profile_id: profileId,
      platform_id: platformId,
      username: newUsername,
      password: newPassword || null,
      security_answer: newSecurityAnswer || null,
      status: "active",
      date_created: new Date(),
    }).returning();
    return newCred.id;
  }

  return null;
}

export const actions: Actions = {
  create: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const note = formData.get("note") as string;
    const search_url = formData.get("search_url") as string;
    const search_term = formData.get("search_term") as string;
    const is_active = formData.get("is_active") !== "false";

    // Platform data
    const platformId = formData.get("platform_id") as string;
    const platformUrl = formData.get("platform_url") as string;
    const platformName = formData.get("platform_name") as string;
    const platformIsNew = formData.get("platform_is_new") === "true";
    const loginPageUrl = formData.get("login_page_url") as string;

    // Credentials data
    const credentialId = formData.get("credential_id") as string;
    const newCredUsername = formData.get("new_credential_username") as string;
    const newCredPassword = formData.get("new_credential_password") as string;
    const newCredSecurityAnswer = formData.get("new_credential_security_answer") as string;

    if (!search_url || search_url.trim().length === 0) {
      return fail(400, { error: "Search URL is required" });
    }

    // Get or create platform
    const resolvedPlatformId = await getOrCreatePlatform(
      platformId,
      platformUrl,
      platformName,
      platformIsNew,
      loginPageUrl,
    );

    // Get or create credentials
    let resolvedCredentialId: number | null = null;
    if (resolvedPlatformId) {
      resolvedCredentialId = await getOrCreateCredentials(
        profileId,
        resolvedPlatformId,
        credentialId,
        newCredUsername,
        newCredPassword,
        newCredSecurityAnswer,
      );
    }

    // Login mode
    const loginMode = formData.get("login_mode") as string;

    // Scraping options
    const browserProvider = formData.get("browser_provider") as string;
    const maxJobsRaw = formData.get("max_jobs") as string;
    const skipFirstRaw = formData.get("skip_first") as string;
    const stopAfterDuplicatesRaw = formData.get(
      "stop_after_duplicates",
    ) as string;
    const skipExistingRaw = formData.get("skip_existing") as string;
    const keepMinimizedRaw = formData.get("keep_minimized") as string;

    const maxJobs = maxJobsRaw ? parseInt(maxJobsRaw) : null;
    const skipFirst = skipFirstRaw ? parseInt(skipFirstRaw) : null;
    const stopAfterDuplicates = stopAfterDuplicatesRaw
      ? parseInt(stopAfterDuplicatesRaw)
      : null;
    const skipExisting = skipExistingRaw === "true";
    const keepMinimized = keepMinimizedRaw === "false" ? false : true;

    // Browser location
    const browserCountryCode = formData.get("browser_country_code") as string;
    if (browserCountryCode) {
      await db.update(profiles).set({ browser_country_code: browserCountryCode.trim().toUpperCase() || null }).where(eq(profiles.id, profileId));
    }

    // Schedule
    const scheduleRaw = formData.get("schedule_interval_hours") as string;
    const scheduleIntervalHours = scheduleRaw ? parseInt(scheduleRaw) : null;

    const [newTask] = await db.insert(search_tasks).values({
      note: note?.trim() || null,
      search_url: search_url.trim(),
      search_term: search_term?.trim() || null,
      platform_id: resolvedPlatformId,
      platform_profile_id: resolvedCredentialId,
      login_mode: ["auto", "manual", "none"].includes(loginMode) ? loginMode : "auto",
      is_active,
      profile_id: profileId,
      status: "idle",
      browser_provider: browserProvider || config.defaultBrowserProvider,
      max_jobs: isNaN(maxJobs as number) ? null : maxJobs,
      skip_first: isNaN(skipFirst as number) ? null : skipFirst,
      stop_after_duplicates: isNaN(stopAfterDuplicates as number)
        ? null
        : stopAfterDuplicates,
      skip_existing: skipExisting,
      keep_minimized: keepMinimized,
      schedule_interval_hours: scheduleIntervalHours && !isNaN(scheduleIntervalHours) ? scheduleIntervalHours : null,
      next_scheduled_run: scheduleIntervalHours && !isNaN(scheduleIntervalHours)
        ? new Date(Date.now() + scheduleIntervalHours * 3600_000)
        : null,
      date_created: new Date(),
    }).returning();

    return { success: true, taskId: newTask.id };
  },

  update: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const note = formData.get("note") as string;
    const search_url = formData.get("search_url") as string;
    const search_term = formData.get("search_term") as string;
    const is_active = formData.get("is_active") !== "false";

    // Platform data
    const platformId = formData.get("platform_id") as string;
    const platformUrl = formData.get("platform_url") as string;
    const platformName = formData.get("platform_name") as string;
    const platformIsNew = formData.get("platform_is_new") === "true";
    const loginPageUrl = formData.get("login_page_url") as string;

    // Credentials data
    const credentialId = formData.get("credential_id") as string;
    const newCredUsername = formData.get("new_credential_username") as string;
    const newCredPassword = formData.get("new_credential_password") as string;
    const newCredSecurityAnswer = formData.get("new_credential_security_answer") as string;

    if (isNaN(id)) {
      return fail(400, { error: "Invalid search ID" });
    }

    const existing = await db.query.search_tasks.findFirst({
      where: and(eq(search_tasks.id, id), eq(search_tasks.profile_id, profileId)),
    });

    if (!existing) {
      return fail(404, { error: "Job search not found" });
    }

    // Get or create platform
    const resolvedPlatformId = await getOrCreatePlatform(
      platformId,
      platformUrl,
      platformName,
      platformIsNew,
      loginPageUrl,
    );

    // Get or create credentials
    let resolvedCredentialId: number | null = null;
    if (resolvedPlatformId) {
      resolvedCredentialId = await getOrCreateCredentials(
        profileId,
        resolvedPlatformId,
        credentialId,
        newCredUsername,
        newCredPassword,
        newCredSecurityAnswer,
      );
    }

    await db.update(search_tasks).set({
      note: note?.trim() || null,
      search_url: search_url?.trim() || null,
      search_term: search_term?.trim() || null,
      platform_id: resolvedPlatformId,
      platform_profile_id: resolvedCredentialId,
      is_active,
      date_updated: new Date(),
    }).where(eq(search_tasks.id, id));

    return { success: true };
  },

  delete: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);

    if (isNaN(id)) {
      return fail(400, { error: "Invalid search ID" });
    }

    const existing = await db.query.search_tasks.findFirst({
      where: and(eq(search_tasks.id, id), eq(search_tasks.profile_id, profileId)),
    });

    if (!existing) {
      return fail(404, { error: "Job search not found" });
    }

    await db.delete(search_tasks).where(eq(search_tasks.id, id));

    return { success: true };
  },
};
