/**
 * Tunnel connection status helpers.
 *
 * The tunnel registry lives in the worker process (port 9333). These helpers
 * query the worker's HTTP status endpoint and apply rules on top of that
 * data — for example, picking which device would be used by default when
 * the user starts a scrape.
 */

import { eq, inArray } from "drizzle-orm";
import { db } from "$lib/server/db";
import { api_keys, device_shares, users } from "$lib/server/db/schema";

const TUNNEL_REQUEST_TIMEOUT_MS = 2000;

export interface TunnelDevice {
  apiKeyId: number;
  apiKeyName: string;
  connectedAt: string;
  lastHeartbeat: string;
  clientVersion: string;
}

export interface TunnelStatus {
  connected: boolean;
  devices: TunnelDevice[];
  status?: string;
}

export interface PreferredDevice extends TunnelDevice {
  isShared: boolean;
  /** Owner display name when shared; null when owned by the requesting user */
  ownerLabel: string | null;
}

export async function fetchProfileTunnelStatus(
  profileId: number,
): Promise<TunnelStatus> {
  try {
    const tunnelHost = process.env.SJS_TUNNEL_HOST || "127.0.0.1";
    const tunnelPort = process.env.SJS_TUNNEL_PORT || "9333";
    const res = await fetch(
      `http://${tunnelHost}:${tunnelPort}/status/${profileId}`,
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
  const ownStatus = await fetchProfileTunnelStatus(profileId);
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
      async (pid) => [pid, await fetchProfileTunnelStatus(pid)] as const,
    ),
  );
  const statusByProfile = new Map(statuses);

  const candidates: Array<
    { device: TunnelDevice; ownerUserId: string | null; sortKey: number }
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
