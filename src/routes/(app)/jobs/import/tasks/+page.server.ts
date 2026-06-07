import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { and, asc, desc, eq, isNotNull, like, or } from "drizzle-orm";
import {
  api_keys,
  job_platforms,
  platform_credentials,
  platform_profiles,
  profile_auto_import,
  profiles,
  search_tasks,
} from "$lib/server/db/schema";
import { config } from "$lib/server/config";
import { encryptCredential } from "$lib/server/auth/crypto";
import { hasCredentialAccess } from "$lib/server/credential-shares";
import { listApiKeys } from "$lib/server/auth/api-key";
import { hasDeviceAccess, listSharedWithMe } from "$lib/server/device-shares";
import { getSelectedProfileId } from "../../../profile/utils";
import { adoptAutoTaskIfManaged } from "$lib/server/import-tasks/reconcile";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }

  const profileId = layoutData.selectedProfile.id;
  const user = layoutData.user;

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
        columns: {
          ui_preferences: true,
          browser_country_code: true,
          country_code: true,
        },
      });
      if (!p) throw new Error("Record not found");
      return p;
    })(),
  ]);
  const searchTasks = searchTasksList;

  // Whether auto-generation of import tasks is enabled for this profile.
  // Defaults to on until the user explicitly turns it off (no row = default).
  const autoImportState = await db.query.profile_auto_import.findFirst({
    where: eq(profile_auto_import.profile_id, profileId),
    columns: { enabled: true },
  });
  const autoImportEnabled = autoImportState?.enabled ?? true;

  const uiPrefs = (profile.ui_preferences as Record<string, unknown>) ?? {};

  // Devices for the new-task browser-control picker: own keys + devices a
  // contact has shared with this user. Mirrors the edit page so the add form
  // shows shared devices too. owner_user_id is null for own devices and the
  // device-owner's user id for shared devices, used to enforce the
  // credential/device-owner coupling at create time.
  interface DeviceOption {
    apiKeyId: number;
    apiKeyName: string;
    shared: boolean;
    owner_user_id: string | null;
  }
  const allApiKeys = await listApiKeys(user.id);
  const apiKeyDevices: DeviceOption[] = allApiKeys
    .filter((k) => !k.revoked)
    .map((k) => ({
      apiKeyId: k.id,
      apiKeyName: k.name,
      shared: false,
      owner_user_id: null,
    }));
  if (user) {
    const sharedDevices = await listSharedWithMe(user.id);
    for (const share of sharedDevices) {
      const ownerName = share.api_key.owner?.name ||
        share.api_key.owner?.email || "Unknown";
      apiKeyDevices.push({
        apiKeyId: share.api_key.id,
        apiKeyName: `${share.api_key.name} (${ownerName})`,
        shared: true,
        owner_user_id: share.api_key.owner?.id ?? null,
      });
    }
  }

  // Platforms the add-task form will offer: any published platform with a
  // `search_page_url` configured (so the scraper knows where to drive the
  // search form).
  const importablePlatforms = await db
    .select({
      id: job_platforms.id,
      key: job_platforms.key,
      name: job_platforms.name,
      url: job_platforms.url,
    })
    .from(job_platforms)
    .where(and(
      isNotNull(job_platforms.search_page_url),
      eq(job_platforms.status, "published"),
    ))
    .orderBy(asc(job_platforms.id));

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
    apiKeyDevices,
    importablePlatforms,
    autoImportEnabled,
  };
};

async function getOrCreatePlatform(
  platformId: string | null,
  platformUrl: string | null,
  platformName: string | null,
  isNew: boolean,
  loginPageUrl: string | null = null,
): Promise<number | null> {
  // Fast path: existing platform_id, no creation needed (AI suggestions hit
  // this — they pass platform_id directly without a URL).
  if (platformId && !isNew) {
    if (loginPageUrl !== null) {
      await db.update(job_platforms).set({
        login_page_url: loginPageUrl || null,
      }).where(eq(job_platforms.id, parseInt(platformId)));
    }
    return parseInt(platformId);
  }

  if (!platformUrl) return null;

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

/**
 * Resolve the per-profile runtime row that backs `search_tasks.platform_profile_id`.
 *
 * The picker speaks in `platform_credentials.id` (user-wide); the search
 * task still references a `platform_profiles` row so each profile keeps
 * its own login state (`status`, `last_login_at`, `login_error`) for the
 * same shared credential. This helper resolves or creates that binding.
 *
 * - `credentialId === "new"`: insert into platform_credentials.
 * - `credentialId` numeric: validate via hasCredentialAccess (owner or
 *   share recipient), then find-or-create the platform_profiles row.
 * - "none" / null / unparseable: return null (task saves with no cred).
 */
async function getOrCreateCredentials(
  profileId: number,
  platformId: number,
  userId: string,
  credentialId: string | null,
  newUsername: string | null,
  newPassword: string | null,
  newSecurityAnswer: string | null = null,
): Promise<number | null> {
  let credId: number | null = null;

  if (credentialId && credentialId !== "none" && credentialId !== "new") {
    const credIdNum = parseInt(credentialId);
    if (isNaN(credIdNum)) return null;
    if (!(await hasCredentialAccess(credIdNum, userId))) return null;
    // Sanity-check the platform matches; the picker shouldn't offer a
    // credential for the wrong platform but defend anyway.
    const cred = await db.query.platform_credentials.findFirst({
      where: and(
        eq(platform_credentials.id, credIdNum),
        eq(platform_credentials.platform_id, platformId),
      ),
      columns: { id: true },
    });
    if (!cred) return null;
    credId = cred.id;
  }

  if (credentialId === "new" && newUsername) {
    const [created] = await db.insert(platform_credentials).values({
      user_id: userId,
      platform_id: platformId,
      username: newUsername,
      password: encryptCredential(newPassword || null),
      security_answer: encryptCredential(newSecurityAnswer || null),
      date_created: new Date(),
      date_updated: new Date(),
    }).returning({ id: platform_credentials.id });
    credId = created.id;
  }

  if (credId === null) return null;

  // Per-profile runtime row: one row per (profile, credential). Reused on
  // subsequent task creations so login_error / last_login_at accumulate
  // against a stable identity rather than spawning duplicate rows.
  const existingPp = await db.query.platform_profiles.findFirst({
    where: and(
      eq(platform_profiles.profile_id, profileId),
      eq(platform_profiles.platform_credential_id, credId),
    ),
    columns: { id: true },
  });
  if (existingPp) return existingPp.id;

  const [newPp] = await db.insert(platform_profiles).values({
    profile_id: profileId,
    platform_id: platformId,
    platform_credential_id: credId,
    status: "active",
    date_created: new Date(),
  }).returning({ id: platform_profiles.id });
  return newPp.id;
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
    const search_location = formData.get("search_location") as string;
    const search_filters_raw = formData.get("search_filters") as string;
    let search_filters: Record<string, string | string[]> = {};
    if (search_filters_raw) {
      try {
        const parsed = JSON.parse(search_filters_raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          search_filters = Object.fromEntries(
            Object.entries(parsed).filter(([k, v]) => {
              if (typeof k !== "string") return false;
              if (typeof v === "string") return true;
              if (Array.isArray(v)) {
                return v.every((x) => typeof x === "string");
              }
              return false;
            }) as [string, string | string[]][],
          );
        }
      } catch {
        // Malformed filter JSON — silently drop. The form always sends
        // valid JSON; bad input here means a client bug or tampering.
      }
    }
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
    const newCredSecurityAnswer = formData.get(
      "new_credential_security_answer",
    ) as string;

    // search_term is OPTIONAL — listing-only platforms (SvelteJobs, X-Team)
    // have no search input to fill, so we just navigate and extract. The
    // scraper checks for keywords/filters at run time and skips form-fill
    // when there's nothing to apply.

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
        user.id,
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
    const sjsBrowserApiKeyRaw = formData.get("sjsbrowser_api_key") as string;
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

    // Resolve and validate tunnel device picked at create time. The user can
    // pick one of their own devices or one a contact has shared with them.
    // When paired with a shared credential the device must be owned by that
    // credential's owner — same coupling rule the PATCH endpoint enforces.
    // Silently drop on mismatch; the user can re-pick on the detail page.
    let resolvedSjsBrowserApiKey: number | null = null;
    const apiKeyId = sjsBrowserApiKeyRaw ? parseInt(sjsBrowserApiKeyRaw) : NaN;
    if (!isNaN(apiKeyId) && (await hasDeviceAccess(apiKeyId, user.id))) {
      let credOwner: string | null = null;
      if (resolvedCredentialId !== null) {
        const pp = await db.query.platform_profiles.findFirst({
          where: eq(platform_profiles.id, resolvedCredentialId),
          columns: { id: true },
          with: {
            platform_credential: { columns: { user_id: true } },
          },
        });
        credOwner = pp?.platform_credential?.user_id ?? null;
      }
      const credIsShared = credOwner !== null && credOwner !== user.id;
      if (!credIsShared) {
        resolvedSjsBrowserApiKey = apiKeyId;
      } else {
        const key = await db.query.api_keys.findFirst({
          where: eq(api_keys.id, apiKeyId),
          columns: { id: true },
          with: { profile: { columns: { user_id: true } } },
        });
        if (key?.profile.user_id === credOwner) {
          resolvedSjsBrowserApiKey = apiKeyId;
        }
      }
    }

    // Browser location
    const browserCountryCode = formData.get("browser_country_code") as string;
    if (browserCountryCode) {
      await db.update(profiles).set({
        browser_country_code: browserCountryCode.trim().toUpperCase() || null,
      }).where(eq(profiles.id, profileId));
    }

    // Schedule
    const scheduleRaw = formData.get("schedule_interval_hours") as string;
    const scheduleIntervalHours = scheduleRaw ? parseInt(scheduleRaw) : null;

    const [newTask] = await db.insert(search_tasks).values({
      note: note?.trim() || null,
      search_url: search_url?.trim() || null,
      search_term: search_term?.trim() || null,
      search_location: search_location?.trim() || null,
      search_filters,
      platform_id: resolvedPlatformId,
      platform_profile_id: resolvedCredentialId,
      login_mode: ["auto", "manual", "none"].includes(loginMode)
        ? loginMode
        : "auto",
      is_active,
      profile_id: profileId,
      status: "idle",
      browser_provider: browserProvider || config.defaultBrowserProvider,
      sjsbrowser_api_key: resolvedSjsBrowserApiKey,
      max_jobs: isNaN(maxJobs as number) ? null : maxJobs,
      skip_first: isNaN(skipFirst as number) ? null : skipFirst,
      stop_after_duplicates: isNaN(stopAfterDuplicates as number)
        ? null
        : stopAfterDuplicates,
      skip_existing: skipExisting,
      keep_minimized: keepMinimized,
      schedule_interval_hours:
        scheduleIntervalHours && !isNaN(scheduleIntervalHours)
          ? scheduleIntervalHours
          : null,
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
    const newCredSecurityAnswer = formData.get(
      "new_credential_security_answer",
    ) as string;

    if (isNaN(id)) {
      return fail(400, { error: "Invalid search ID" });
    }

    const existing = await db.query.search_tasks.findFirst({
      where: and(
        eq(search_tasks.id, id),
        eq(search_tasks.profile_id, profileId),
      ),
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
        user.id,
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

    // A hand-edit means the user has taken ownership: stop auto-managing this
    // task so the reconciler won't prune or overwrite their changes. No-op
    // unless it was an auto task.
    await adoptAutoTaskIfManaged(id);

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
      where: and(
        eq(search_tasks.id, id),
        eq(search_tasks.profile_id, profileId),
      ),
    });

    if (!existing) {
      return fail(404, { error: "Job search not found" });
    }

    await db.delete(search_tasks).where(eq(search_tasks.id, id));

    return { success: true };
  },

  toggleAutoImport: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const enabled = formData.get("enabled") === "true";

    // Upsert the per-profile sync-state row's enable flag. Turning it back on
    // doesn't itself regenerate — the next profile/preference change (or a
    // forced re-suggest) does, via the input-hash gate.
    await db
      .insert(profile_auto_import)
      .values({ profile_id: profileId, enabled })
      .onConflictDoUpdate({
        target: profile_auto_import.profile_id,
        set: { enabled, date_updated: new Date() },
      });

    return { success: true };
  },
};
