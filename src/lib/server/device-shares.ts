/**
 * Device sharing service — share tunnel devices (API keys) with contacts.
 *
 * Devices are owned by users (via `api_keys.user_id`); ownership checks
 * are a direct comparison rather than a profile traversal.
 */

import { db } from "$lib/server/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { api_keys, device_shares, users } from "$lib/server/db/schema";
import { areContacts } from "$lib/server/contacts";
import { createNotification } from "$lib/server/notifications";
import { revokeOrphanedCredentialShares } from "$lib/server/credential-shares";

/**
 * Share a device with a user (must be an accepted contact).
 */
export async function shareDevice(
  apiKeyId: number,
  ownerId: string,
  sharedWithUserId: string,
): Promise<{ success: boolean; error?: string }> {
  const apiKey = await db.query.api_keys.findFirst({
    where: and(
      eq(api_keys.id, apiKeyId),
      eq(api_keys.user_id, ownerId),
      eq(api_keys.revoked, false),
    ),
    columns: { id: true },
  });

  if (!apiKey) {
    return { success: false, error: "Device not found" };
  }

  if (!(await areContacts(ownerId, sharedWithUserId))) {
    return {
      success: false,
      error: "You can only share devices with your contacts",
    };
  }

  const existing = await db.query.device_shares.findFirst({
    where: and(
      eq(device_shares.api_key_id, apiKeyId),
      eq(device_shares.shared_with, sharedWithUserId),
    ),
  });

  if (existing) {
    return {
      success: false,
      error: "Device is already shared with this contact",
    };
  }

  await db.insert(device_shares).values({
    api_key_id: apiKeyId,
    shared_with: sharedWithUserId,
  });

  const ownerUser = await db.query.users.findFirst({
    where: eq(users.id, ownerId),
    columns: { name: true, email: true },
  });
  const ownerName = ownerUser?.name || ownerUser?.email || "Someone";
  await createNotification({
    userId: sharedWithUserId,
    type: "device_share",
    title: `${ownerName} shared a device with you`,
    link: "/jobs/import/devices",
  }).catch(() => {});

  return { success: true };
}

/**
 * Unshare a device from a user.
 */
export async function unshareDevice(
  apiKeyId: number,
  ownerId: string,
  sharedWithUserId: string,
): Promise<boolean> {
  const apiKey = await db.query.api_keys.findFirst({
    where: and(
      eq(api_keys.id, apiKeyId),
      eq(api_keys.user_id, ownerId),
    ),
    columns: { id: true },
  });

  if (!apiKey) return false;

  const result = await db.delete(device_shares).where(
    and(
      eq(device_shares.api_key_id, apiKeyId),
      eq(device_shares.shared_with, sharedWithUserId),
    ),
  );

  if ((result.rowCount ?? 0) > 0) {
    // Drop any credentials this owner had shared with the contact if no
    // other devices of theirs remain shared — credentials are unusable
    // without a device of the owner to run on.
    await revokeOrphanedCredentialShares(ownerId, sharedWithUserId);
  }

  return (result.rowCount ?? 0) > 0;
}

/** List shares for a specific device (who it's shared with). */
export async function listDeviceShares(apiKeyId: number) {
  return db.query.device_shares.findMany({
    where: eq(device_shares.api_key_id, apiKeyId),
    columns: {
      id: true,
      date_created: true,
    },
    with: {
      user: { columns: { id: true, name: true, email: true, image: true } },
    },
    orderBy: desc(device_shares.date_created),
  });
}

/** List devices shared with a user (devices they can use from contacts). */
export async function listSharedWithMe(userId: string) {
  const shares = await db.query.device_shares.findMany({
    where: eq(device_shares.shared_with, userId),
    columns: {
      id: true,
      date_created: true,
    },
    with: {
      api_key: {
        columns: {
          id: true,
          name: true,
          key_plain: true,
          user_id: true,
        },
      },
    },
    orderBy: desc(device_shares.date_created),
  });

  const ownerIds = [...new Set(shares.map((s) => s.api_key.user_id))];
  const owners = ownerIds.length > 0
    ? await db.query.users.findMany({
      where: inArray(users.id, ownerIds),
      columns: { id: true, name: true, email: true },
    })
    : [];
  const ownerMap = new Map(owners.map((o) => [o.id, o]));

  return shares.map((s) => {
    const owner = ownerMap.get(s.api_key.user_id) ?? null;
    return {
      id: s.id,
      date_created: s.date_created,
      api_key: {
        id: s.api_key.id,
        name: s.api_key.name,
        key_plain: s.api_key.key_plain,
        owner,
      },
    };
  });
}

/**
 * Check if a user has access to a device (either owns it or it's shared with them).
 */
export async function hasDeviceAccess(
  apiKeyId: number,
  userId: string,
): Promise<boolean> {
  const owned = await db.query.api_keys.findFirst({
    where: and(
      eq(api_keys.id, apiKeyId),
      eq(api_keys.user_id, userId),
      eq(api_keys.revoked, false),
    ),
    columns: { id: true },
  });
  if (owned) return true;

  const shared = await db.query.device_shares.findFirst({
    where: and(
      eq(device_shares.api_key_id, apiKeyId),
      eq(device_shares.shared_with, userId),
    ),
    columns: { id: true },
  });

  return !!shared;
}
