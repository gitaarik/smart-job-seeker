/**
 * Loader helper for the admin discovery run form. Returns the credentials
 * and devices the current user can pick from for a given platform — own
 * platform_profiles + ones shared with them, own api_keys + ones shared.
 *
 * Also returns `profileId`, the admin's primary profile, which the
 * `CredentialSelector` component needs to add/edit/delete credentials
 * inline. Returns `null` if the admin has no profile yet (rare — usually
 * means a freshly-created account).
 */

import { dbDirect as db } from "$lib/server/db";
import { asc } from "drizzle-orm";
import { platform_profiles } from "$lib/server/db/schema";
import { listApiKeys } from "$lib/server/auth/api-key";
import { listSharedWithMe } from "$lib/server/device-shares";
import { listSharedCredentialsWithMe } from "$lib/server/credential-shares";
import { decryptCredential } from "$lib/server/auth/crypto";

export interface DiscoveryCredentialOption {
  id: number;
  username: string | null;
  security_answer: string | null;
  shared: boolean;
  owner_user_id: string | null;
  owner_label: string | null;
}

export interface DiscoveryDeviceOption {
  apiKeyId: number;
  apiKeyName: string;
  shared: boolean;
}

export async function loadDiscoveryFormData(
  platformId: number,
  userId: string,
): Promise<{
  credentials: DiscoveryCredentialOption[];
  devices: DiscoveryDeviceOption[];
  profileId: number | null;
}> {
  const profilesOwned = await db.query.profiles.findMany({
    where: (p, { eq }) => eq(p.user_id, userId),
    columns: { id: true },
    orderBy: (p, { asc }) => asc(p.id),
  });
  const ownedProfileIds = profilesOwned.map((p) => p.id);
  const profileId = profilesOwned[0]?.id ?? null;

  const credentials: DiscoveryCredentialOption[] = [];
  if (ownedProfileIds.length > 0) {
    const raw = await db.query.platform_profiles.findMany({
      where: (pp, { eq, and, inArray }) =>
        and(
          eq(pp.platform_id, platformId),
          inArray(pp.profile_id, ownedProfileIds),
        ),
      columns: { id: true, username: true, security_answer: true },
      orderBy: asc(platform_profiles.id),
    });
    for (const c of raw) {
      credentials.push({
        id: c.id,
        username: c.username,
        security_answer: decryptCredential(c.security_answer),
        shared: false,
        owner_user_id: null,
        owner_label: null,
      });
    }
  }
  const sharedCreds = await listSharedCredentialsWithMe(userId);
  for (const s of sharedCreds) {
    if (s.platform_profile.platform_id !== platformId) continue;
    const ownerLabel = s.platform_profile.owner?.name ||
      s.platform_profile.owner?.email || "a contact";
    credentials.push({
      id: s.platform_profile.id,
      username: s.platform_profile.username,
      security_answer: null,
      shared: true,
      owner_user_id: s.platform_profile.owner?.id ?? null,
      owner_label: ownerLabel,
    });
  }

  const devices: DiscoveryDeviceOption[] = [];
  for (const p of profilesOwned) {
    const keys = await listApiKeys(p.id);
    for (const k of keys) {
      if (!k.revoked) {
        devices.push({
          apiKeyId: k.id,
          apiKeyName: k.name,
          shared: false,
        });
      }
    }
  }
  const sharedDevices = await listSharedWithMe(userId);
  for (const share of sharedDevices) {
    const ownerName = share.api_key.owner?.name ||
      share.api_key.owner?.email || "Unknown";
    devices.push({
      apiKeyId: share.api_key.id,
      apiKeyName: `${share.api_key.name} (${ownerName})`,
      shared: true,
    });
  }

  return { credentials, devices, profileId };
}
