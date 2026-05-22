/**
 * Loader helper for the admin discovery run form. Returns the credentials
 * and devices the current user can pick from for a given platform — own
 * user-wide platform_credentials + ones shared with them, own api_keys +
 * ones shared.
 *
 * Also returns `profileId`, the admin's primary profile, which the
 * `CredentialSelector` component needs to add/edit/delete credentials
 * inline. Returns `null` if the admin has no profile yet (rare — usually
 * means a freshly-created account).
 */

import { dbDirect as db } from "$lib/server/db";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { platform_credentials } from "$lib/server/db/schema";
import { listApiKeys } from "$lib/server/auth/api-key";
import { listSharedWithMe } from "$lib/server/device-shares";
import { listSharedCredentialsWithMe } from "$lib/server/credential-shares";
import { decryptCredential } from "$lib/server/auth/crypto";

export interface DiscoveryCredentialOption {
  /** platform_credentials.id */
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

export async function loadSearchFormProbeFormData(
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
  const profileId = profilesOwned[0]?.id ?? null;

  const credentials: DiscoveryCredentialOption[] = [];
  const raw = await db.query.platform_credentials.findMany({
    where: and(
      eq(platform_credentials.user_id, userId),
      eq(platform_credentials.platform_id, platformId),
      isNotNull(platform_credentials.username),
    ),
    columns: { id: true, username: true, security_answer: true },
    orderBy: asc(platform_credentials.id),
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
  const sharedCreds = await listSharedCredentialsWithMe(userId);
  for (const s of sharedCreds) {
    if (s.platform_credential.platform_id !== platformId) continue;
    const ownerLabel = s.platform_credential.owner?.name ||
      s.platform_credential.owner?.email || "a contact";
    credentials.push({
      id: s.platform_credential.id,
      username: s.platform_credential.username,
      security_answer: null,
      shared: true,
      owner_user_id: s.platform_credential.owner?.id ?? null,
      owner_label: ownerLabel,
    });
  }

  const devices: DiscoveryDeviceOption[] = [];
  const keys = await listApiKeys(userId);
  for (const k of keys) {
    if (!k.revoked) {
      devices.push({
        apiKeyId: k.id,
        apiKeyName: k.name,
        shared: false,
      });
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
