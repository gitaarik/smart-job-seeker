import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import {
  platform_profiles,
  profiles,
  search_tasks,
} from "$lib/server/db/schema";
import { getGeoConfig } from "$lib/server/browser/geo-utils";
import { config } from "$lib/server/config";
import { getActiveSubscription } from "$lib/server/billing/subscription";
import { getOrCreateVerificationAddress } from "$lib/server/email/verification-relay";
import { listApiKeys } from "$lib/server/auth/api-key";
import { decryptCredential } from "$lib/server/auth/crypto";
import { listSharedWithMe } from "$lib/server/device-shares";
import { listSharedCredentialsWithMe } from "$lib/server/credential-shares";

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
    where: and(
      eq(search_tasks.id, searchTaskId),
      eq(search_tasks.profile_id, layoutData.selectedProfile.id),
    ),
    with: {
      job_platform: true,
      platform_profile: true,
    },
  });

  if (!searchTask) {
    throw error(404, "Job search not found");
  }

  const user = layoutData.user;

  // Load credentials the user can pick on this task: their own for this
  // platform plus credentials for this platform shared with them. Shared
  // credentials never expose the password — that stays server-side and is
  // only resolved by the scraper at run time.
  interface CredentialOption {
    id: number;
    username: string | null;
    security_answer: string | null;
    shared: boolean;
    owner_user_id: string | null;
    owner_label: string | null;
  }
  let platformCredentials: CredentialOption[] = [];
  if (searchTask.platform_id) {
    const rawCredentials = await db.query.platform_profiles.findMany({
      where: and(
        eq(platform_profiles.profile_id, layoutData.selectedProfile.id),
        eq(platform_profiles.platform_id, searchTask.platform_id),
      ),
      columns: { id: true, username: true, security_answer: true },
      orderBy: asc(platform_profiles.date_created),
    });
    platformCredentials = rawCredentials.map((c) => ({
      ...c,
      security_answer: decryptCredential(c.security_answer),
      shared: false,
      owner_user_id: null,
      owner_label: null,
    }));
  }

  if (user && searchTask.platform_id) {
    const sharedCreds = await listSharedCredentialsWithMe(user.id);
    for (const s of sharedCreds) {
      if (s.platform_profile.platform_id !== searchTask.platform_id) continue;
      const ownerLabel = s.platform_profile.owner?.name ||
        s.platform_profile.owner?.email || "a contact";
      platformCredentials.push({
        id: s.platform_profile.id,
        username: s.platform_profile.username,
        // Shared credentials never reveal the security_answer either.
        security_answer: null,
        shared: true,
        owner_user_id: s.platform_profile.owner_user_id,
        owner_label: ownerLabel,
      });
    }
  }

  // Check if user is staff or admin
  const isStaff = (user as { is_staff?: boolean })?.is_staff ||
    (user as { is_admin?: boolean })?.is_admin || false;

  // Check if user can edit platform URLs (login_page_url on job_platforms).
  // Staff can always edit. Normal users can edit only if no other user's
  // accounts reference this platform (cheap existence check with LIMIT 1).
  let canEditPlatformUrls = isStaff;
  if (!canEditPlatformUrls && searchTask.platform_id && user) {
    const [otherUserUsage] = await db
      .select({ id: search_tasks.id })
      .from(search_tasks)
      .innerJoin(profiles, eq(profiles.id, search_tasks.profile_id))
      .where(
        and(
          eq(search_tasks.platform_id, searchTask.platform_id),
          ne(profiles.user_id, user.id),
        ),
      )
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
  const effectiveCountryCode = profileData?.browser_country_code ||
    profileData?.country_code || "US";
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
  const verificationAddress = await getOrCreateVerificationAddress(
    layoutData.selectedProfile.id,
  );

  // Load API keys for device selection (tunnel mode) — own + shared.
  // owner_user_id is null for own devices and the credential-owner's user id
  // for shared devices, so the picker can match a shared credential to a
  // compatible device.
  interface DeviceOption {
    apiKeyId: number;
    apiKeyName: string;
    shared: boolean;
    owner_user_id: string | null;
  }
  const allApiKeys = await listApiKeys(layoutData.selectedProfile.id);
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
    uiPreferences: ((searchTask as any).ui_preferences ?? {}) as Record<
      string,
      unknown
    >,
    verificationEmailAddress: verificationAddress.fullAddress,
    apiKeyDevices,
  };
};
