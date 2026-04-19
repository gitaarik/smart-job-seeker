/**
 * Device sharing service — share tunnel devices (API keys) with contacts
 */

import { db } from "$lib/server/db";
import { areContacts } from "$lib/server/contacts";
import { createNotification } from "$lib/server/notifications";

/**
 * Share a device with a user (must be an accepted contact)
 */
export async function shareDevice(
  apiKeyId: number,
  ownerId: string,
  sharedWithUserId: string,
): Promise<{ success: boolean; error?: string }> {
  // Verify the API key belongs to the owner
  const apiKey = await db.query.api_keys.findFirst({
    where: { id: apiKeyId, revoked: false },
    select: { id: true, profiles: { select: { user_id: true } } },
  });

  if (!apiKey || apiKey.profiles.user_id !== ownerId) {
    return { success: false, error: "Device not found" };
  }

  // Verify they are contacts
  if (!(await areContacts(ownerId, sharedWithUserId))) {
    return { success: false, error: "You can only share devices with your contacts" };
  }

  // Check if already shared
  const existing = await db.query.device_shares.findFirst({
    where: { api_key_id: apiKeyId, shared_with: sharedWithUserId },
  });

  if (existing) {
    return { success: false, error: "Device is already shared with this contact" };
  }

  await db.device_shares.create({
    data: {
      api_key_id: apiKeyId,
      shared_with: sharedWithUserId,
    },
  });

  // Notify the recipient
  const ownerUser = await db.query.users.findFirst({
    where: { id: ownerId },
    select: { name: true, email: true },
  });
  const ownerName = ownerUser?.name || ownerUser?.email || "Someone";
  await createNotification({
    userId: sharedWithUserId,
    type: "device_share",
    title: `${ownerName} shared a device with you`,
    link: "/dashboard/contacts",
  }).catch(() => {});

  return { success: true };
}

/**
 * Unshare a device from a user
 */
export async function unshareDevice(
  apiKeyId: number,
  ownerId: string,
  sharedWithUserId: string,
): Promise<boolean> {
  // Verify ownership
  const apiKey = await db.query.api_keys.findFirst({
    where: { id: apiKeyId },
    select: { id: true, profiles: { select: { user_id: true } } },
  });

  if (!apiKey || apiKey.profiles.user_id !== ownerId) {
    return false;
  }

  const result = await db.device_shares.deleteMany({
    where: { api_key_id: apiKeyId, shared_with: sharedWithUserId },
  });

  return result.count > 0;
}

/**
 * List shares for a specific device (who it's shared with)
 */
export async function listDeviceShares(apiKeyId: number) {
  return db.query.device_shares.findMany({
    where: { api_key_id: apiKeyId },
    select: {
      id: true,
      date_created: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { date_created: "desc" },
  });
}

/**
 * List devices shared with a user (devices they can use from contacts)
 */
export async function listSharedWithMe(userId: string) {
  const shares = await db.query.device_shares.findMany({
    where: { shared_with: userId },
    select: {
      id: true,
      date_created: true,
      api_key: {
        select: {
          id: true,
          name: true,
          key_plain: true,
          profiles: {
            select: { user_id: true },
          },
        },
      },
    },
    orderBy: { date_created: "desc" },
  });

  // Resolve owner names from user_ids
  const ownerIds = [...new Set(shares.map((s) => s.api_key.profiles.user_id).filter(Boolean))] as string[];
  const owners = ownerIds.length > 0
    ? await db.query.users.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const ownerMap = new Map(owners.map((o) => [o.id, o]));

  return shares.map((s) => {
    const owner = ownerMap.get(s.api_key.profiles.user_id ?? "") ?? null;
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
 * Check if a user has access to a device (either owns it or it's shared with them)
 */
export async function hasDeviceAccess(apiKeyId: number, userId: string): Promise<boolean> {
  // Check ownership
  const owned = await db.query.api_keys.findFirst({
    where: { id: apiKeyId, revoked: false },
    select: { id: true, profiles: { select: { user_id: true } } },
  });

  if (owned && owned.profiles.user_id === userId) {
    return true;
  }

  // Check shared access
  const shared = await db.query.device_shares.findFirst({
    where: { api_key_id: apiKeyId, shared_with: userId },
    select: { id: true },
  });

  return !!shared;
}
