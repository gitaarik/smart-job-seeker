import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, ne, inArray, asc } from "drizzle-orm";
import { search_tasks, profiles, platform_profiles } from "$lib/server/db/schema";
import { getGeoConfig } from "$lib/server/browser/geo-utils";
import { config } from "$lib/server/config";
import { getActiveSubscription } from "$lib/server/billing/subscription";
import { getOrCreateVerificationAddress } from "$lib/server/email/verification-relay";
import { listApiKeys } from "$lib/server/auth/api-key";
import { decryptCredential } from "$lib/server/auth/crypto";
import { listSharedWithMe } from "$lib/server/device-shares";

export const load: PageServerLoad = async ({ params, parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }

  const searchTaskId = parseInt(params.id);
  if (isNaN(searchTaskId)) {
    throw error(400, "Invalid job search ID");
  }

  const searchTask = await db.query.search_tasks.findFirst({
    where: and(eq(search_tasks.id, searchTaskId), eq(search_tasks.profile_id, layoutData.selectedProfile.id)),
    with: {
      job_platform: true,
      platform_profile: true,
    },
  });

  if (!searchTask) {
    throw error(404, "Job search not found");
  }

  // Load all credentials for this platform so user can switch
  let platformCredentials: Array<{
    id: number;
    username: string | null;
    security_answer: string | null;
  }> = [];
  if (searchTask.platform_id) {
    const rawCredentials = await db.query.platform_profiles.findMany({
      where: and(eq(platform_profiles.profile_id, layoutData.selectedProfile.id), eq(platform_profiles.platform_id, searchTask.platform_id)),
      columns: { id: true, username: true, security_answer: true },
      orderBy: asc(platform_profiles.date_created),
    });
    platformCredentials = rawCredentials.map((c) => ({
      ...c,
      security_answer: decryptCredential(c.security_answer),
    }));
  }

  // Check if user is staff or admin
  const user = layoutData.user;
  const isStaff = (user as { is_staff?: boolean })?.is_staff || (user as { is_admin?: boolean })?.is_admin || false;

  // Check if user can edit platform URLs (login_page_url on job_platforms).
  // Staff can always edit. Normal users can edit only if no other user's
  // accounts reference this platform (cheap existence check with LIMIT 1).
  let canEditPlatformUrls = isStaff;
  if (!canEditPlatformUrls && searchTask.platform_id && user) {
    const [otherUserUsage] = await db
      .select({ id: search_tasks.id })
      .from(search_tasks)
      .innerJoin(profiles, eq(profiles.id, search_tasks.profile_id))
      .where(and(eq(search_tasks.platform_id, searchTask.platform_id), ne(profiles.user_id, user.id)))
      .limit(1);
    canEditPlatformUrls = !otherUserUsage;
  }

  // Load profile data (country code + browser fingerprint fields)
  const profileData = await db.query.profiles.findFirst({
    where: eq(profiles.id, layoutData.selectedProfile.id),
    columns: {
      country_code: true,
      browser_country_code: true,
      browser_language: true,
      browser_timezone: true,
    },
  });

  // Compute geo-derived defaults from the effective country code
  const effectiveCountryCode = profileData?.browser_country_code || profileData?.country_code || "US";
  const geoDefaults = getGeoConfig(effectiveCountryCode);

  // Check if any other search task for this profile is currently running/queued/blocked
  const otherRunning = await db.query.search_tasks.findFirst({
    where: and(
      eq(search_tasks.profile_id, layoutData.selectedProfile.id),
      ne(search_tasks.id, searchTaskId),
      inArray(search_tasks.status, ["running", "queued", "blocked"]),
    ),
    columns: { id: true },
  });

  const subscription = user ? await getActiveSubscription(user.id) : null;

  // Auto-generate verification email forwarding address on first visit
  const verificationAddress = await getOrCreateVerificationAddress(layoutData.selectedProfile.id);

  // Load API keys for device selection (tunnel mode) — own + shared
  const allApiKeys = await listApiKeys(layoutData.selectedProfile.id);
  const apiKeyDevices = allApiKeys
    .filter(k => !k.revoked)
    .map(k => ({ apiKeyId: k.id, apiKeyName: k.name, shared: false }));

  // Add devices shared with this user
  if (user) {
    const sharedDevices = await listSharedWithMe(user.id);
    for (const share of sharedDevices) {
      const ownerName = share.api_key.owner?.name || share.api_key.owner?.email || "Unknown";
      apiKeyDevices.push({
        apiKeyId: share.api_key.id,
        apiKeyName: `${share.api_key.name} (${ownerName})`,
        shared: true,
      });
    }
  }

  return {
    searchTask,
    platformCredentials,
    profileId: layoutData.selectedProfile.id,
    isStaff,
    canEditPlatformUrls,
    hasOtherRunning: !!otherRunning,
    subscriptionRenewDate: subscription?.currentPeriodEnd ?? null,
    browserCountryCode: profileData?.browser_country_code || "",
    defaultCountryCode: profileData?.country_code || "",
    browserProvider: config.browserProvider,
    localBrowserAllowed: config.localBrowserAllowed,
    // Browser fingerprint: saved values + geo-derived defaults
    browserFingerprint: {
      language: profileData?.browser_language || "",
      timezone: profileData?.browser_timezone || "",
    },
    browserFingerprintDefaults: {
      language: geoDefaults.language,
      timezone: geoDefaults.timezone,
    },
    uiPreferences: ((searchTask as any).ui_preferences ?? {}) as Record<string, unknown>,
    verificationEmailAddress: verificationAddress.fullAddress,
    apiKeyDevices,
  };
};
