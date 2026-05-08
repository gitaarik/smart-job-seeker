/**
 * Tunnel connection status helpers.
 *
 * The tunnel registry lives in the worker process (port 9333). These helpers
 * query the worker's HTTP status endpoint and apply rules on top of that
 * data — for example, picking which device would be used by default when
 * the user starts a scrape.
 */

import { and, eq, inArray } from "drizzle-orm";
import { db } from "$lib/server/db";
import { api_keys, device_shares, users } from "$lib/server/db/schema";

const TUNNEL_REQUEST_TIMEOUT_MS = 2000;

export interface SjsBrowserDevice {
  apiKeyId: number;
  apiKeyName: string;
  connectedAt: string;
  lastHeartbeat: string;
  clientVersion: string;
}

export interface SjsBrowserStatus {
  connected: boolean;
  devices: SjsBrowserDevice[];
  status?: string;
}

export interface PreferredDevice extends SjsBrowserDevice {
  isShared: boolean;
  /** Owner display name when shared; null when owned by the requesting user */
  ownerLabel: string | null;
}

export async function fetchProfileSjsBrowserStatus(
  profileId: number,
): Promise<SjsBrowserStatus> {
  try {
    const sjsBrowserHost = process.env.SJS_TUNNEL_HOST || "127.0.0.1";
    const sjsBrowserPort = process.env.SJS_TUNNEL_PORT || "9333";
    const res = await fetch(
      `http://${sjsBrowserHost}:${sjsBrowserPort}/status/${profileId}`,
      { signal: AbortSignal.timeout(TUNNEL_REQUEST_TIMEOUT_MS) },
    );
    if (res.ok) return await res.json();
    return { connected: false, devices: [], status: "unavailable" };
  } catch {
    return { connected: false, devices: [], status: "unavailable" };
  }
}

/**
 * Pick the device that would be used for scraping by default.
 *
 * Rule:
 *   1. Prefer the user's own connected devices on `profileId`.
 *   2. Fall back to connected devices shared with the user.
 *   3. Within each tier, sort by api_key.date_created ASC (oldest first) so
 *      the choice is stable when new devices are added.
 *
 * Returns null when no relevant device is connected.
 */
export async function getPreferredDevice(
  userId: string,
  profileId: number,
): Promise<PreferredDevice | null> {
  const ownStatus = await fetchProfileSjsBrowserStatus(profileId);
  if (ownStatus.devices.length > 0) {
    const ownedKeys = await db.query.api_keys.findMany({
      where: inArray(
        api_keys.id,
        ownStatus.devices.map((d) => d.apiKeyId),
      ),
      columns: { id: true, date_created: true },
    });
    const dateMap = new Map(
      ownedKeys.map((k) => [k.id, k.date_created?.getTime() ?? 0]),
    );
    const pick = [...ownStatus.devices].sort(
      (a, b) => (dateMap.get(a.apiKeyId) ?? 0) - (dateMap.get(b.apiKeyId) ?? 0),
    )[0];
    return { ...pick, isShared: false, ownerLabel: null };
  }

  const shares = await db.query.device_shares.findMany({
    where: eq(device_shares.shared_with, userId),
    columns: { id: true },
    with: {
      api_key: {
        columns: {
          id: true,
          name: true,
          profile_id: true,
          date_created: true,
        },
        with: {
          profile: { columns: { user_id: true } },
        },
      },
    },
  });
  if (shares.length === 0) return null;

  const profileIds = [...new Set(shares.map((s) => s.api_key.profile_id))];
  const statuses = await Promise.all(
    profileIds.map(
      async (pid) => [pid, await fetchProfileSjsBrowserStatus(pid)] as const,
    ),
  );
  const statusByProfile = new Map(statuses);

  const candidates: Array<
    { device: SjsBrowserDevice; ownerUserId: string | null; sortKey: number }
  > = [];
  for (const share of shares) {
    const status = statusByProfile.get(share.api_key.profile_id);
    if (!status) continue;
    const device = status.devices.find((d) => d.apiKeyId === share.api_key.id);
    if (!device) continue;
    candidates.push({
      device,
      ownerUserId: share.api_key.profile.user_id ?? null,
      sortKey: share.api_key.date_created?.getTime() ?? 0,
    });
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.sortKey - b.sortKey);
  const pick = candidates[0];

  let ownerLabel: string | null = null;
  if (pick.ownerUserId) {
    const owner = await db.query.users.findFirst({
      where: eq(users.id, pick.ownerUserId),
      columns: { name: true, email: true },
    });
    ownerLabel = owner?.name || owner?.email || null;
  }

  return { ...pick.device, isShared: true, ownerLabel };
}

/**
 * Status of a specific device by api_key id, regardless of whether it is
 * the user's preferred default. Used by the search-task UI to show the
 * device that will actually be used (the task's configured `sjsbrowser_api_key`),
 * not the user's first-connected fallback.
 *
 * Returns null if the device isn't connected, isn't owned/shared by the
 * user, or doesn't belong to the given profile.
 */
/**
 * Resolve the upstream `(profileId, apiKeyId)` pair for a tunnel-relay
 * request (VNC, screencast, input) that came in addressed to a request
 * `profileId`.
 *
 * The dashboard sends the *task's* profile_id (which is the user's profile);
 * but when the task uses a shared device, the actual tunnel registry entry
 * lives on the *device owner's* profile. Without resolving, the upstream
 * 404s with "No active tunnel".
 *
 *   1. If the caller passed an explicit `apiKeyId`, validate access to it
 *      and return that device's owner profile_id + apiKeyId.
 *   2. Otherwise auto-pick the same way the Devices page does (own
 *      connected first, then shared connected).
 *   3. If neither resolves to a connected device, return the original
 *      profileId with no apiKeyId — the upstream will 404, which is the
 *      same behaviour as before this helper existed.
 */
export async function resolveTunnelDevice(
  userId: string,
  profileId: number,
  apiKeyIdRaw: string | null,
): Promise<{ profileId: number; apiKeyId?: number }> {
  if (apiKeyIdRaw) {
    const apiKeyId = Number.parseInt(apiKeyIdRaw, 10);
    if (!Number.isFinite(apiKeyId)) {
      return { profileId };
    }
    const device = await getDeviceById(userId, profileId, apiKeyId);
    if (!device) return { profileId };
    const apiKey = await db.query.api_keys.findFirst({
      where: eq(api_keys.id, apiKeyId),
      columns: { profile_id: true },
    });
    return {
      profileId: apiKey?.profile_id ?? profileId,
      apiKeyId,
    };
  }

  const preferred = await getPreferredDevice(userId, profileId);
  if (!preferred) return { profileId };

  const apiKey = await db.query.api_keys.findFirst({
    where: eq(api_keys.id, preferred.apiKeyId),
    columns: { profile_id: true },
  });
  return {
    profileId: apiKey?.profile_id ?? profileId,
    apiKeyId: preferred.apiKeyId,
  };
}

export async function getDeviceById(
  userId: string,
  profileId: number,
  apiKeyId: number,
): Promise<PreferredDevice | null> {
  const apiKey = await db.query.api_keys.findFirst({
    where: eq(api_keys.id, apiKeyId),
    columns: { id: true, profile_id: true },
    with: {
      profile: { columns: { user_id: true } },
    },
  });
  if (!apiKey) return null;

  const ownerUserId = apiKey.profile.user_id ?? null;
  const ownedByUser = ownerUserId === userId;

  // For own devices, scope to the requested profile (a user with multiple
  // profiles shouldn't see another profile's devices on this task page).
  // For shared devices, the device belongs to a different profile by
  // definition; we trust the share grant.
  if (ownedByUser && apiKey.profile_id !== profileId) return null;
  if (!ownedByUser) {
    const share = await db.query.device_shares.findFirst({
      where: and(
        eq(device_shares.shared_with, userId),
        eq(device_shares.api_key_id, apiKeyId),
      ),
      columns: { id: true },
    });
    if (!share) return null;
  }

  const status = await fetchProfileSjsBrowserStatus(apiKey.profile_id);
  const device = status.devices.find((d) => d.apiKeyId === apiKeyId);
  if (!device) return null;

  if (ownedByUser) {
    return { ...device, isShared: false, ownerLabel: null };
  }

  let ownerLabel: string | null = null;
  if (ownerUserId) {
    const owner = await db.query.users.findFirst({
      where: eq(users.id, ownerUserId),
      columns: { name: true, email: true },
    });
    ownerLabel = owner?.name || owner?.email || null;
  }
  return { ...device, isShared: true, ownerLabel };
}
