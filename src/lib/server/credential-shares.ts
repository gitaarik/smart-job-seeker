/**
 * Credential sharing service — share platform_credentials (login username +
 * encrypted password for a job platform) with contacts.
 *
 * Constraint: a contact who has a credential shared with them can use it on
 * an import task ONLY in combination with one of the credential owner's
 * devices that has also been shared with them. The password never crosses
 * to the contact's session — the scraper resolves it server-side at run
 * time via `decryptCredential()`.
 *
 * Credentials are user-wide (owned via `platform_credentials.user_id`), so
 * intra-user "sharing" doesn't exist as a row in this table — every profile
 * of the owner already sees the credential. This table handles cross-user
 * sharing only.
 *
 * Mirrors device-shares.ts.
 */

import { db } from '$lib/server/db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import {
	api_keys,
	credential_shares,
	device_shares,
	platform_credentials,
	users
} from '$lib/server/db/schema';
import { areContacts } from '$lib/server/contacts';
import { createNotification } from '$lib/server/notifications';

/** Resolve all platform_credential ids owned by a user. */
async function ownedCredentialIds(ownerId: string): Promise<number[]> {
	const creds = await db.query.platform_credentials.findMany({
		where: eq(platform_credentials.user_id, ownerId),
		columns: { id: true }
	});
	return creds.map((c) => c.id);
}

/** Resolve all api_key ids owned by a user. */
async function ownedApiKeyIds(ownerId: string): Promise<number[]> {
	const keys = await db.query.api_keys.findMany({
		where: eq(api_keys.user_id, ownerId),
		columns: { id: true }
	});
	return keys.map((k) => k.id);
}

/**
 * Share a credential with a contact.
 */
export async function shareCredential(
	platformCredentialId: number,
	ownerId: string,
	sharedWithUserId: string
): Promise<{ success: boolean; error?: string }> {
	const credential = await db.query.platform_credentials.findFirst({
		where: and(
			eq(platform_credentials.id, platformCredentialId),
			eq(platform_credentials.user_id, ownerId)
		),
		columns: { id: true, username: true, platform_id: true }
	});

	if (!credential) {
		return { success: false, error: 'Credential not found' };
	}

	if (!(await areContacts(ownerId, sharedWithUserId))) {
		return {
			success: false,
			error: 'You can only share credentials with your contacts'
		};
	}

	const existing = await db.query.credential_shares.findFirst({
		where: and(
			eq(credential_shares.platform_credential_id, platformCredentialId),
			eq(credential_shares.shared_with, sharedWithUserId)
		)
	});
	if (existing) {
		return {
			success: false,
			error: 'Credential is already shared with this contact'
		};
	}

	await db.insert(credential_shares).values({
		platform_credential_id: platformCredentialId,
		shared_with: sharedWithUserId
	});

	const ownerUser = await db.query.users.findFirst({
		where: eq(users.id, ownerId),
		columns: { name: true, email: true }
	});
	const ownerName = ownerUser?.name || ownerUser?.email || 'Someone';
	await createNotification({
		userId: sharedWithUserId,
		type: 'credential_share',
		title: `${ownerName} shared a login with you`,
		link: '/jobs/import/devices'
	}).catch(() => {});

	return { success: true };
}

/**
 * Unshare a credential from a contact.
 */
export async function unshareCredential(
	platformCredentialId: number,
	ownerId: string,
	sharedWithUserId: string
): Promise<boolean> {
	const credential = await db.query.platform_credentials.findFirst({
		where: and(
			eq(platform_credentials.id, platformCredentialId),
			eq(platform_credentials.user_id, ownerId)
		),
		columns: { id: true }
	});
	if (!credential) return false;

	const result = await db
		.delete(credential_shares)
		.where(
			and(
				eq(credential_shares.platform_credential_id, platformCredentialId),
				eq(credential_shares.shared_with, sharedWithUserId)
			)
		);
	return (result.rowCount ?? 0) > 0;
}

/**
 * List shares for a specific credential (who it's shared with).
 */
export async function listCredentialShares(platformCredentialId: number) {
	return db.query.credential_shares.findMany({
		where: eq(credential_shares.platform_credential_id, platformCredentialId),
		columns: {
			id: true,
			date_created: true
		},
		with: {
			user: { columns: { id: true, name: true, email: true, image: true } }
		},
		orderBy: desc(credential_shares.date_created)
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
			platform_credential: {
				columns: {
					id: true,
					username: true,
					platform_id: true,
					user_id: true
				},
				with: {
					job_platform: { columns: { id: true, name: true } }
				}
			}
		},
		orderBy: desc(credential_shares.date_created)
	});

	const ownerIds = [...new Set(shares.map((s) => s.platform_credential.user_id))];
	const owners =
		ownerIds.length > 0
			? await db.query.users.findMany({
					where: inArray(users.id, ownerIds),
					columns: { id: true, name: true, email: true }
				})
			: [];
	const ownerMap = new Map(owners.map((o) => [o.id, o]));

	return shares.map((s) => {
		const ownerUserId = s.platform_credential.user_id;
		const owner = ownerMap.get(ownerUserId) ?? null;
		return {
			id: s.id,
			date_created: s.date_created,
			platform_credential: {
				id: s.platform_credential.id,
				username: s.platform_credential.username,
				platform_id: s.platform_credential.platform_id,
				platform: s.platform_credential.job_platform,
				owner_user_id: ownerUserId,
				owner
			}
		};
	});
}

/**
 * Check whether a user can use this credential on a task — owns it
 * directly, or it's been shared with them.
 */
export async function hasCredentialAccess(
	platformCredentialId: number,
	userId: string
): Promise<boolean> {
	const owned = await db.query.platform_credentials.findFirst({
		where: and(
			eq(platform_credentials.id, platformCredentialId),
			eq(platform_credentials.user_id, userId)
		),
		columns: { id: true }
	});
	if (owned) return true;

	const shared = await db.query.credential_shares.findFirst({
		where: and(
			eq(credential_shares.platform_credential_id, platformCredentialId),
			eq(credential_shares.shared_with, userId)
		),
		columns: { id: true }
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
	contactId: string
): Promise<number> {
	const ownerKeyIds = await ownedApiKeyIds(ownerId);
	if (ownerKeyIds.length > 0) {
		const remaining = await db.query.device_shares.findFirst({
			where: and(
				inArray(device_shares.api_key_id, ownerKeyIds),
				eq(device_shares.shared_with, contactId)
			),
			columns: { id: true }
		});
		if (remaining) return 0;
	}
	return revokeAllCredentialSharesBetween(ownerId, contactId);
}

/** Drop every credential share `ownerId` granted to `contactId`. */
export async function revokeAllCredentialSharesBetween(
	ownerId: string,
	contactId: string
): Promise<number> {
	const ids = await ownedCredentialIds(ownerId);
	if (ids.length === 0) return 0;
	const result = await db
		.delete(credential_shares)
		.where(
			and(
				inArray(credential_shares.platform_credential_id, ids),
				eq(credential_shares.shared_with, contactId)
			)
		);
	return result.rowCount ?? 0;
}

/**
 * Drop every device + credential share between two users, in both directions.
 * Used when a contact relationship is removed.
 */
export async function revokeAllSharesBetweenContacts(userA: string, userB: string): Promise<void> {
	const [aKeys, bKeys] = await Promise.all([ownedApiKeyIds(userA), ownedApiKeyIds(userB)]);
	if (aKeys.length > 0) {
		await db
			.delete(device_shares)
			.where(and(inArray(device_shares.api_key_id, aKeys), eq(device_shares.shared_with, userB)));
	}
	if (bKeys.length > 0) {
		await db
			.delete(device_shares)
			.where(and(inArray(device_shares.api_key_id, bKeys), eq(device_shares.shared_with, userA)));
	}
	await revokeAllCredentialSharesBetween(userA, userB);
	await revokeAllCredentialSharesBetween(userB, userA);
}
