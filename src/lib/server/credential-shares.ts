/**
 * Credential sharing service — share platform_profile credentials (login
 * username + encrypted password for a job platform) with contacts.
 *
 * Constraint: a contact who has a credential shared with them can use it on
 * an import task ONLY in combination with one of the credential owner's
 * devices that has also been shared with them. The password never crosses
 * to the contact's session — the scraper resolves it server-side at run
 * time via `decryptCredential()` on the owner's row.
 *
 * Mirrors device-shares.ts.
 */

import { db } from "$lib/server/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  api_keys,
  credential_shares,
  device_shares,
  platform_profiles,
  profiles,
  users,
} from "$lib/server/db/schema";
import { areContacts } from "$lib/server/contacts";
import { createNotification } from "$lib/server/notifications";

/** Resolve all platform_profile ids owned (transitively, via profiles) by a user. */
async function ownedCredentialIds(ownerId: string): Promise<number[]> {
  const ownerProfiles = await db.query.profiles.findMany({
    where: eq(profiles.user_id, ownerId),
    columns: { id: true },
  });
  const profileIds = ownerProfiles.map((p) => p.id);
  if (profileIds.length === 0) return [];
  const creds = await db.query.platform_profiles.findMany({
    where: inArray(platform_profiles.profile_id, profileIds),
    columns: { id: true },
  });
  return creds.map((c) => c.id);
}

/** Resolve all api_key ids owned by a user via their profiles. */
async function ownedApiKeyIds(ownerId: string): Promise<number[]> {
  const ownerProfiles = await db.query.profiles.findMany({
    where: eq(profiles.user_id, ownerId),
    columns: { id: true },
  });
  const profileIds = ownerProfiles.map((p) => p.id);
  if (profileIds.length === 0) return [];
  const keys = await db.query.api_keys.findMany({
    where: inArray(api_keys.profile_id, profileIds),
    columns: { id: true },
  });
  return keys.map((k) => k.id);
}

/**
 * Share a credential (platform_profile) with a contact.
 */
export async function shareCredential(
  platformProfileId: number,
  ownerId: string,
  sharedWithUserId: string,
): Promise<{ success: boolean; error?: string }> {
  // Verify the credential belongs to the owner via its profile
  const credential = await db.query.platform_profiles.findFirst({
    where: eq(platform_profiles.id, platformProfileId),
    columns: { id: true, username: true, platform_id: true },
    with: { profile: { columns: { user_id: true } } },
  });

  if (!credential || credential.profile.user_id !== ownerId) {
    return { success: false, error: "Credential not found" };
  }

  if (!(await areContacts(ownerId, sharedWithUserId))) {
    return {
      success: false,
      error: "You can only share credentials with your contacts",
    };
  }

  const existing = await db.query.credential_shares.findFirst({
    where: and(
      eq(credential_shares.platform_profile_id, platformProfileId),
      eq(credential_shares.shared_with, sharedWithUserId),
    ),
  });
  if (existing) {
    return {
      success: false,
      error: "Credential is already shared with this contact",
    };
  }

  await db.insert(credential_shares).values({
    platform_profile_id: platformProfileId,
    shared_with: sharedWithUserId,
  });

  // Notify the recipient
  const ownerUser = await db.query.users.findFirst({
    where: eq(users.id, ownerId),
    columns: { name: true, email: true },
  });
  const ownerName = ownerUser?.name || ownerUser?.email || "Someone";
  await createNotification({
    userId: sharedWithUserId,
    type: "credential_share",
    title: `${ownerName} shared a login with you`,
    link: "/jobs/import/devices",
  }).catch(() => {});

  return { success: true };
}

/**
 * Unshare a credential from a contact.
 */
export async function unshareCredential(
  platformProfileId: number,
  ownerId: string,
  sharedWithUserId: string,
): Promise<boolean> {
  const credential = await db.query.platform_profiles.findFirst({
    where: eq(platform_profiles.id, platformProfileId),
    columns: { id: true },
    with: { profile: { columns: { user_id: true } } },
  });
  if (!credential || credential.profile.user_id !== ownerId) {
    return false;
  }

  const result = await db.delete(credential_shares).where(
    and(
      eq(credential_shares.platform_profile_id, platformProfileId),
      eq(credential_shares.shared_with, sharedWithUserId),
    ),
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * List shares for a specific credential (who it's shared with).
 */
export async function listCredentialShares(platformProfileId: number) {
  return db.query.credential_shares.findMany({
    where: eq(credential_shares.platform_profile_id, platformProfileId),
    columns: {
      id: true,
      date_created: true,
    },
    with: {
      user: { columns: { id: true, name: true, email: true, image: true } },
    },
    orderBy: desc(credential_shares.date_created),
  });
}

/**
 * List credentials shared with a user (credentials they can pick on tasks).
 */
export async function listSharedCredentialsWithMe(userId: string) {
  const shares = await db.query.credential_shares.findMany({
    where: eq(credential_shares.shared_with, userId),
    columns: { id: true, date_created: true },
    with: {
      platform_profile: {
        columns: { id: true, username: true, platform_id: true, status: true },
        with: {
          profile: { columns: { user_id: true } },
          job_platform: { columns: { id: true, name: true } },
        },
      },
    },
    orderBy: desc(credential_shares.date_created),
  });

  const ownerIds = [
    ...new Set(
      shares.map((s) => s.platform_profile.profile.user_id).filter(Boolean),
    ),
  ] as string[];
  const owners = ownerIds.length > 0
    ? await db.query.users.findMany({
      where: inArray(users.id, ownerIds),
      columns: { id: true, name: true, email: true },
    })
    : [];
  const ownerMap = new Map(owners.map((o) => [o.id, o]));

  return shares.map((s) => {
    const ownerUserId = s.platform_profile.profile.user_id ?? "";
    const owner = ownerMap.get(ownerUserId) ?? null;
    return {
      id: s.id,
      date_created: s.date_created,
      platform_profile: {
        id: s.platform_profile.id,
        username: s.platform_profile.username,
        platform_id: s.platform_profile.platform_id,
        status: s.platform_profile.status,
        platform: s.platform_profile.job_platform,
        owner_user_id: ownerUserId || null,
        owner,
      },
    };
  });
}

/**
 * Check whether a user can pick this credential on a task — owns it directly,
 * or it's been shared with them.
 */
export async function hasCredentialAccess(
  platformProfileId: number,
  userId: string,
): Promise<boolean> {
  const owned = await db.query.platform_profiles.findFirst({
    where: eq(platform_profiles.id, platformProfileId),
    columns: { id: true },
    with: { profile: { columns: { user_id: true } } },
  });
  if (owned && owned.profile.user_id === userId) return true;

  const shared = await db.query.credential_shares.findFirst({
    where: and(
      eq(credential_shares.platform_profile_id, platformProfileId),
      eq(credential_shares.shared_with, userId),
    ),
    columns: { id: true },
  });
  return !!shared;
}

/**
 * Revoke credentials `ownerId` had shared with `contactId` if no device of
 * `ownerId` remains shared with `contactId`. Called from `unshareDevice`
 * after a device share is removed — a shared credential is useless without
 * one of the owner's devices to run on, so we proactively clean up rather
 * than letting tasks silently fail validation later.
 */
export async function revokeOrphanedCredentialShares(
  ownerId: string,
  contactId: string,
): Promise<number> {
  const ownerKeyIds = await ownedApiKeyIds(ownerId);
  if (ownerKeyIds.length > 0) {
    const remaining = await db.query.device_shares.findFirst({
      where: and(
        inArray(device_shares.api_key_id, ownerKeyIds),
        eq(device_shares.shared_with, contactId),
      ),
      columns: { id: true },
    });
    if (remaining) return 0;
  }
  return revokeAllCredentialSharesBetween(ownerId, contactId);
}

/** Drop every credential share `ownerId` granted to `contactId`. */
export async function revokeAllCredentialSharesBetween(
  ownerId: string,
  contactId: string,
): Promise<number> {
  const ids = await ownedCredentialIds(ownerId);
  if (ids.length === 0) return 0;
  const result = await db.delete(credential_shares).where(
    and(
      inArray(credential_shares.platform_profile_id, ids),
      eq(credential_shares.shared_with, contactId),
    ),
  );
  return result.rowCount ?? 0;
}

/**
 * Drop every device + credential share between two users, in both directions.
 * Used when a contact relationship is removed.
 */
export async function revokeAllSharesBetweenContacts(
  userA: string,
  userB: string,
): Promise<void> {
  const [aKeys, bKeys] = await Promise.all([
    ownedApiKeyIds(userA),
    ownedApiKeyIds(userB),
  ]);
  if (aKeys.length > 0) {
    await db.delete(device_shares).where(
      and(
        inArray(device_shares.api_key_id, aKeys),
        eq(device_shares.shared_with, userB),
      ),
    );
  }
  if (bKeys.length > 0) {
    await db.delete(device_shares).where(
      and(
        inArray(device_shares.api_key_id, bKeys),
        eq(device_shares.shared_with, userA),
      ),
    );
  }
  await revokeAllCredentialSharesBetween(userA, userB);
  await revokeAllCredentialSharesBetween(userB, userA);
}
