/**
 * Grants an admin can attach to an invitation.
 *
 * Inviting someone almost always came with two follow-ups: open
 * `/admin/users/[id]` and set their plan, then share a device with them from
 * the contacts page. Both are things the admin already decided at invite time,
 * so they ride along in the invite payload instead.
 *
 * The grants are applied *at acceptance*, not at mint:
 *
 * - `device_shares.shared_with` and `subscriptions.user_id` both FK `users.id`,
 *   so there is nothing to write to until the account exists.
 * - Plan length is therefore stored as a **duration**, not an end date. An
 *   invite can sit unopened for 30 days; an absolute "expires 2026-09-30"
 *   picked at mint time would quietly hand out two days of Seeker to someone
 *   who accepted on the 28th. `/admin/users/[id]` keeps its absolute date —
 *   there the user already exists, so there is no gap to drift across.
 *
 * Application is best-effort. This runs at the tail of someone's signup, and a
 * device revoked in the days since the invite was minted must not cost them
 * their account. Failures come back as warnings and are reported to the
 * inviter rather than thrown.
 */

import { dbDirect as db } from '$lib/server/db';
import { and, eq, inArray } from 'drizzle-orm';
import { api_keys, subscriptions } from '$lib/server/db/schema';
import { PLAN_LIMITS, type PlanId } from '$lib/server/billing/plans';
import { ensureAcceptedContact } from '$lib/server/contacts';
import { insertDeviceShare } from '$lib/server/device-shares';
import { createNotification } from '$lib/server/notifications';
import crypto from 'crypto';

/** Subscription statuses that count as "the user already has a plan". */
const LIVE_STATUSES = ['active', 'trialing', 'past_due'];

/** Durations offered in the invite form, in months. */
export const PLAN_DURATION_MONTHS = [1, 3, 6, 12, 24] as const;

/** Used when a plan is granted without an explicit duration. */
export const DEFAULT_PLAN_MONTHS = 12;

export interface InviteGrants {
	/** Admin who sent the invite — the owner of any devices being shared. */
	inviterId?: string;
	/** Plan to grant on acceptance. `explorer` is the free tier: no grant. */
	plan?: PlanId;
	/** Subscription length in months, counted from acceptance (see above). */
	planMonths?: number;
	/** Devices belonging to `inviterId` to share on acceptance. */
	deviceIds?: number[];
}

function errMsg(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

/** `from` plus `months`, matching the day-rollover behaviour of `setMonth`. */
export function addMonths(from: Date, months: number): Date {
	const d = new Date(from);
	d.setMonth(d.getMonth() + months);
	return d;
}

/** Cancel every live subscription a user has. */
export async function cancelActiveSubscriptions(userId: string): Promise<void> {
	await db
		.update(subscriptions)
		.set({
			status: 'canceled',
			date_updated: new Date()
		})
		.where(and(eq(subscriptions.user_id, userId), inArray(subscriptions.status, LIVE_STATUSES)));
}

/**
 * Whether the user already has a live subscription.
 *
 * Deliberately a direct query on `subscriptions` rather than
 * `getActiveSubscription()`: that helper is one of the cloud overlay's
 * esbuild-swapped files and its OSS stub always answers "explorer", which
 * would make every caller of this a no-op in the OSS tree.
 */
export async function hasLiveSubscription(userId: string): Promise<boolean> {
	const sub = await db.query.subscriptions.findFirst({
		where: and(eq(subscriptions.user_id, userId), inArray(subscriptions.status, LIVE_STATUSES)),
		columns: { id: true }
	});
	return !!sub;
}

/**
 * Write an admin-granted subscription — no Stripe round-trip, placeholder ids
 * to satisfy the not-null columns. This is the path every plan on the system
 * currently arrives by; Stripe is not wired up in any environment yet.
 */
export async function insertAdminGrant(
	userId: string,
	plan: string,
	periodEnd: Date
): Promise<void> {
	await db.insert(subscriptions).values({
		user_id: userId,
		stripe_subscription_id: `admin_grant_${crypto.randomUUID()}`,
		stripe_price_id: 'admin_grant',
		plan,
		status: 'active',
		current_period_start: new Date(),
		current_period_end: periodEnd,
		cancel_at_period_end: false,
		date_created: new Date()
	});
}

/**
 * Read grant fields off an admin form.
 *
 * Device ownership is verified here rather than at apply time: the ids come
 * from a form post, so an admin could otherwise hand out a device belonging to
 * someone else, and a bad id should be a form error now instead of a silent
 * no-op when the invitee eventually accepts.
 */
export async function parseInviteGrants(
	formData: FormData,
	inviterId: string
): Promise<{ grants: InviteGrants } | { error: string }> {
	const grants: InviteGrants = { inviterId };

	const plan = ((formData.get('plan') as string | null) ?? '').trim();
	if (plan && plan !== 'explorer') {
		if (!(plan in PLAN_LIMITS)) {
			return { error: 'Invalid plan' };
		}
		grants.plan = plan as PlanId;

		const monthsRaw = ((formData.get('plan_months') as string | null) ?? '').trim();
		const months = monthsRaw ? parseInt(monthsRaw, 10) : DEFAULT_PLAN_MONTHS;
		if (!Number.isFinite(months) || months <= 0 || months > 120) {
			return { error: 'Plan duration must be between 1 and 120 months' };
		}
		grants.planMonths = months;
	}

	const deviceIds = formData
		.getAll('device_ids')
		.map((v) => parseInt(v as string, 10))
		.filter((n) => Number.isFinite(n));

	if (deviceIds.length > 0) {
		const owned = await db.query.api_keys.findMany({
			where: and(
				eq(api_keys.user_id, inviterId),
				eq(api_keys.revoked, false),
				inArray(api_keys.id, deviceIds)
			),
			columns: { id: true }
		});
		if (owned.length !== deviceIds.length) {
			return { error: "One or more selected devices aren't yours" };
		}
		grants.deviceIds = deviceIds;
	}

	return { grants };
}

/**
 * Recover the grants from a stored invite payload. Tolerates invites minted
 * before grants existed (and any hand-edited row) by simply finding nothing.
 */
export function grantsFromInvitePayload(
	data: Record<string, unknown> | null | undefined
): InviteGrants {
	if (!data) return {};
	const deviceIds = Array.isArray(data.deviceIds)
		? data.deviceIds.filter((n): n is number => typeof n === 'number')
		: undefined;
	return {
		inviterId: typeof data.inviterId === 'string' ? data.inviterId : undefined,
		plan:
			typeof data.plan === 'string' && data.plan in PLAN_LIMITS ? (data.plan as PlanId) : undefined,
		planMonths: typeof data.planMonths === 'number' ? data.planMonths : undefined,
		deviceIds: deviceIds?.length ? deviceIds : undefined
	};
}

/** True if there is anything for `applyInviteGrants` to do. */
export function hasGrants(grants: InviteGrants): boolean {
	return !!grants.plan || !!grants.deviceIds?.length;
}

/**
 * Apply an invite's grants to a freshly-provisioned account.
 *
 * Never throws — returns the list of things that didn't work so the caller can
 * carry on with the signup. Anything that failed is also pushed to the inviter
 * as a notification, since the invitee has no way to know a device they were
 * promised never arrived.
 */
export async function applyInviteGrants(
	userId: string,
	grants: InviteGrants | null | undefined
): Promise<string[]> {
	if (!grants) return [];
	const warnings: string[] = [];

	if (grants.plan && grants.plan !== 'explorer') {
		try {
			// Don't clobber a plan the account already has. An invite can be sent to
			// an existing user (`/admin/users/[id]` → send_invite), and an admin
			// grant landing on top of a real subscription would be a downgrade
			// nobody asked for.
			if (await hasLiveSubscription(userId)) {
				warnings.push(
					`Plan "${grants.plan}" not granted: the account already has an active subscription.`
				);
			} else {
				await insertAdminGrant(
					userId,
					grants.plan,
					addMonths(new Date(), grants.planMonths ?? DEFAULT_PLAN_MONTHS)
				);
			}
		} catch (e) {
			warnings.push(`Plan "${grants.plan}" not granted: ${errMsg(e)}`);
		}
	}

	const deviceIds = grants.deviceIds ?? [];
	if (deviceIds.length > 0 && grants.inviterId) {
		try {
			// The invite is the owner's consent, so the shares below bypass the
			// contact gate (insertDeviceShare, not shareDevice) — the same
			// arrangement demo links use. The contact row is still created, so the
			// recipient sees a named owner on the devices page and the contacts page
			// agrees with it.
			await ensureAcceptedContact(grants.inviterId, userId);
		} catch (e) {
			warnings.push(`Could not link the accounts as contacts: ${errMsg(e)}`);
		}

		for (const deviceId of deviceIds) {
			try {
				const result = await insertDeviceShare(deviceId, grants.inviterId, userId);
				if (!result.success && result.error !== 'Device is already shared with this contact') {
					warnings.push(`Device ${deviceId} not shared: ${result.error}`);
				}
			} catch (e) {
				warnings.push(`Device ${deviceId} not shared: ${errMsg(e)}`);
			}
		}
	}

	if (warnings.length > 0) {
		console.error(`[invite-grants] user ${userId}: ${warnings.join(' ')}`);
		if (grants.inviterId) {
			await createNotification({
				userId: grants.inviterId,
				type: 'invite_grant_failed',
				title: 'Some invite grants could not be applied',
				message: warnings.join(' '),
				link: `/admin/users/${userId}`
			}).catch(() => {});
		}
	}

	return warnings;
}
