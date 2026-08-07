/**
 * Device sharing service — share tunnel devices (API keys) with contacts.
 *
 * Devices are owned by users (via `api_keys.user_id`); ownership checks
 * are a direct comparison rather than a profile traversal.
 */

import { db } from '$lib/server/db';
import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import { api_keys, device_shares, users, verifications } from '$lib/server/db/schema';
import { areContacts, ensureAcceptedContact } from '$lib/server/contacts';
import { createNotification } from '$lib/server/notifications';
import { revokeOrphanedCredentialShares } from '$lib/server/credential-shares';
import { randomBytes } from 'node:crypto';

/**
 * Share a device with a user (must be an accepted contact).
 */
export async function shareDevice(
	apiKeyId: number,
	ownerId: string,
	sharedWithUserId: string
): Promise<{ success: boolean; error?: string }> {
	const apiKey = await db.query.api_keys.findFirst({
		where: and(
			eq(api_keys.id, apiKeyId),
			eq(api_keys.user_id, ownerId),
			eq(api_keys.revoked, false)
		),
		columns: { id: true }
	});

	if (!apiKey) {
		return { success: false, error: 'Device not found' };
	}

	if (!(await areContacts(ownerId, sharedWithUserId))) {
		return {
			success: false,
			error: 'You can only share devices with your contacts'
		};
	}

	return insertDeviceShare(apiKeyId, ownerId, sharedWithUserId);
}

/**
 * Grant a device share without the contact gate.
 *
 * This is the bare write (ownership + duplicate check, insert, notify) that
 * `shareDevice()` delegates to after its `areContacts()` check. It exists as a
 * separate export so authorization can come from elsewhere — e.g. a single-use
 * device-invite link, where the link itself is the owner's consent and there is
 * no pre-existing contact relationship. Callers that bypass `shareDevice()` are
 * responsible for establishing that authorization (and, where appropriate, the
 * accepted-contact row) before calling this.
 */
export async function insertDeviceShare(
	apiKeyId: number,
	ownerId: string,
	sharedWithUserId: string
): Promise<{ success: boolean; error?: string }> {
	const apiKey = await db.query.api_keys.findFirst({
		where: and(
			eq(api_keys.id, apiKeyId),
			eq(api_keys.user_id, ownerId),
			eq(api_keys.revoked, false)
		),
		columns: { id: true }
	});

	if (!apiKey) {
		return { success: false, error: 'Device not found' };
	}

	const existing = await db.query.device_shares.findFirst({
		where: and(
			eq(device_shares.api_key_id, apiKeyId),
			eq(device_shares.shared_with, sharedWithUserId)
		)
	});

	if (existing) {
		return {
			success: false,
			error: 'Device is already shared with this contact'
		};
	}

	await db.insert(device_shares).values({
		api_key_id: apiKeyId,
		shared_with: sharedWithUserId
	});

	const ownerUser = await db.query.users.findFirst({
		where: eq(users.id, ownerId),
		columns: { name: true, email: true }
	});
	const ownerName = ownerUser?.name || ownerUser?.email || 'Someone';
	await createNotification({
		userId: sharedWithUserId,
		type: 'device_share',
		title: `${ownerName} shared a device with you`,
		link: '/jobs/import/devices'
	}).catch(() => {});

	return { success: true };
}

/**
 * Unshare a device from a user.
 */
export async function unshareDevice(
	apiKeyId: number,
	ownerId: string,
	sharedWithUserId: string
): Promise<boolean> {
	const apiKey = await db.query.api_keys.findFirst({
		where: and(eq(api_keys.id, apiKeyId), eq(api_keys.user_id, ownerId)),
		columns: { id: true }
	});

	if (!apiKey) return false;

	const result = await db
		.delete(device_shares)
		.where(
			and(eq(device_shares.api_key_id, apiKeyId), eq(device_shares.shared_with, sharedWithUserId))
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
			date_created: true
		},
		with: {
			user: { columns: { id: true, name: true, email: true, image: true } }
		},
		orderBy: desc(device_shares.date_created)
	});
}

/**
 * List devices shared with a user (devices they can use from contacts).
 *
 * Deliberately without the key. A contact uses a shared device through the
 * import flow, which goes via the owner's device — they never configure a
 * tunnel client themselves, so there is nothing here for a key to be for. It
 * used to be selected and returned anyway, and every one of this function's
 * five callers dropped it: the devices page explicitly, the other four by never
 * looking. That is a device credential travelling to someone who isn't its
 * owner for no reason, which is worth not doing even when nobody reads it.
 */
export async function listSharedWithMe(userId: string) {
	const shares = await db.query.device_shares.findMany({
		where: eq(device_shares.shared_with, userId),
		columns: {
			id: true,
			date_created: true
		},
		with: {
			api_key: {
				columns: {
					id: true,
					name: true,
					user_id: true
				}
			}
		},
		orderBy: desc(device_shares.date_created)
	});

	const ownerIds = [...new Set(shares.map((s) => s.api_key.user_id))];
	const owners =
		ownerIds.length > 0
			? await db.query.users.findMany({
					where: inArray(users.id, ownerIds),
					columns: { id: true, name: true, email: true }
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
				owner
			}
		};
	});
}

/**
 * List the current user's own (non-revoked) devices that they've shared out,
 * keyed by the contact they're shared with. Used on the contacts page to show
 * which devices you've shared with each contact.
 */
export async function listDevicesSharedByMe(
	ownerId: string
): Promise<Record<string, { id: number; name: string }[]>> {
	const ownDevices = await db.query.api_keys.findMany({
		where: and(eq(api_keys.user_id, ownerId), eq(api_keys.revoked, false)),
		columns: { id: true, name: true }
	});
	if (ownDevices.length === 0) return {};

	const deviceMap = new Map(ownDevices.map((d) => [d.id, d]));
	const shares = await db.query.device_shares.findMany({
		where: inArray(
			device_shares.api_key_id,
			ownDevices.map((d) => d.id)
		),
		columns: { api_key_id: true, shared_with: true }
	});

	const byContact: Record<string, { id: number; name: string }[]> = {};
	for (const s of shares) {
		const device = deviceMap.get(s.api_key_id);
		if (!device) continue;
		(byContact[s.shared_with] ??= []).push({
			id: device.id,
			name: device.name
		});
	}
	return byContact;
}

/**
 * Check if a user has access to a device (either owns it or it's shared with them).
 */
export async function hasDeviceAccess(apiKeyId: number, userId: string): Promise<boolean> {
	const owned = await db.query.api_keys.findFirst({
		where: and(
			eq(api_keys.id, apiKeyId),
			eq(api_keys.user_id, userId),
			eq(api_keys.revoked, false)
		),
		columns: { id: true }
	});
	if (owned) return true;

	const shared = await db.query.device_shares.findFirst({
		where: and(eq(device_shares.api_key_id, apiKeyId), eq(device_shares.shared_with, userId)),
		columns: { id: true }
	});

	return !!shared;
}

// --- Device invite links -------------------------------------------------
//
// A one-link onboarding for non-self-hosters: the owner mints a short-lived,
// single-use link that, when accepted, makes the recipient an accepted contact
// AND shares the device with them in one step — no prior contact handshake.
// The link itself is the owner's consent, so acceptance bypasses the
// `areContacts()` gate via `insertDeviceShare()`.
//
// Stored in the existing `verifications` table (same mechanism as email
// signup invites): `identifier = "device-invite:<token>"`, `value` = the JSON
// payload below. `value` is varchar(255), so the payload is kept compact.

const DEVICE_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEVICE_INVITE_PREFIX = 'device-invite:';

interface DeviceInvitePayload {
	token: string;
	kind: 'device-share';
	inviterId: string;
	apiKeyId: number;
}

/** Mint a single-use device-invite link. Caller must own the device. */
export async function createDeviceInvite(
	apiKeyId: number,
	ownerId: string
): Promise<{ success: boolean; token?: string; error?: string }> {
	const apiKey = await db.query.api_keys.findFirst({
		where: and(
			eq(api_keys.id, apiKeyId),
			eq(api_keys.user_id, ownerId),
			eq(api_keys.revoked, false)
		),
		columns: { id: true }
	});
	if (!apiKey) {
		return { success: false, error: 'Device not found' };
	}

	const token = randomBytes(24).toString('hex');
	const payload: DeviceInvitePayload = {
		token,
		kind: 'device-share',
		inviterId: ownerId,
		apiKeyId
	};
	const now = new Date();
	await db.insert(verifications).values({
		id: crypto.randomUUID(),
		identifier: `${DEVICE_INVITE_PREFIX}${token}`,
		value: JSON.stringify(payload),
		expiresAt: new Date(now.getTime() + DEVICE_INVITE_TTL_MS),
		createdAt: now,
		updatedAt: now
	});

	return { success: true, token };
}

export interface DeviceInviteInfo {
	inviterId: string;
	apiKeyId: number;
	verificationId: string;
	inviterName: string;
	deviceName: string;
}

/** Resolve a device-invite token to its (unexpired, valid) details, or null. */
export async function getDeviceInvite(token: string): Promise<DeviceInviteInfo | null> {
	const row = await db.query.verifications.findFirst({
		where: and(
			eq(verifications.identifier, `${DEVICE_INVITE_PREFIX}${token}`),
			gt(verifications.expiresAt, new Date())
		)
	});
	if (!row) return null;

	let payload: DeviceInvitePayload;
	try {
		payload = JSON.parse(row.value);
	} catch {
		return null;
	}
	if (payload.kind !== 'device-share') return null;

	const [inviter, device] = await Promise.all([
		db.query.users.findFirst({
			where: eq(users.id, payload.inviterId),
			columns: { name: true, email: true }
		}),
		db.query.api_keys.findFirst({
			where: eq(api_keys.id, payload.apiKeyId),
			columns: { name: true }
		})
	]);

	return {
		inviterId: payload.inviterId,
		apiKeyId: payload.apiKeyId,
		verificationId: row.id,
		inviterName: inviter?.name || inviter?.email || 'Someone',
		deviceName: device?.name || 'a device'
	};
}

/**
 * Accept a device invite for `inviteeId`: make them an accepted contact of the
 * inviter and share the device, then consume the link. Idempotent w.r.t. an
 * already-existing share.
 */
export async function acceptDeviceInvite(
	token: string,
	inviteeId: string
): Promise<{ success: boolean; error?: string }> {
	const invite = await getDeviceInvite(token);
	if (!invite) {
		return {
			success: false,
			error: 'This invite link is invalid or has expired.'
		};
	}
	if (invite.inviterId === inviteeId) {
		return {
			success: false,
			error: "You can't accept your own device invite."
		};
	}

	await ensureAcceptedContact(invite.inviterId, inviteeId);

	const result = await insertDeviceShare(invite.apiKeyId, invite.inviterId, inviteeId);
	// An already-existing share is fine on accept — treat as success.
	if (!result.success && result.error !== 'Device is already shared with this contact') {
		return result;
	}

	await db.delete(verifications).where(eq(verifications.id, invite.verificationId));

	return { success: true };
}
