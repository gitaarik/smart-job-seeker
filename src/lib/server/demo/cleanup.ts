/**
 * Expire and deactivate demo links past their TTL (or revoked).
 *
 * Safety-first: this cuts off the demo user's access — drops their sessions
 * (forces logout), removes their device shares (stops scraping on the host's
 * devices), de-approves the account (blocks the API), unenrols their profile
 * from community matching — then flips the link to `expired`. Hard-deleting the
 * demo user + cloned data is a deliberate follow-up (no tested cascade for
 * profiles yet); deactivation is what matters for protecting the host's devices
 * and credits.
 *
 * ## Why the matching gets turned off too
 *
 * Cutting access is not the same as cutting spend, and for a while this only
 * did the first. The matcher works off PROFILES and never reads
 * `users.is_approved`, so a demo nobody can log into any more went on being
 * scored against every new job in the shared pool, twice per job, forever.
 * Measured on preview 2026-09-08: a demo whose link expired six weeks earlier
 * had spent 899 LLM calls and 12.3M input tokens in the first eight days of
 * September alone, reproducing matches no one could see.
 *
 * `match_community_jobs = false` leaves the profile and its existing matches
 * exactly where they are — it only stops NEW jobs being scored for it, which is
 * the whole of the ongoing cost. It is also reversible in one UPDATE, which is
 * why it can live here while the hard delete stays a follow-up.
 *
 * Run periodically from the worker. Idempotent.
 */

import { and, eq, inArray, lte, ne, or } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import {
	credential_shares,
	demo_links,
	device_shares,
	match_config,
	profiles,
	sessions,
	users
} from '$lib/server/db/schema';

export interface DemoCleanupResult {
	linksExpired: number;
	usersDeactivated: number;
	/** Profiles unenrolled from community matching, i.e. stopped costing money. */
	profilesUnenrolled: number;
}

export async function cleanupExpiredDemoLinks(): Promise<DemoCleanupResult> {
	// Links that should no longer grant access: still 'active' but past TTL, or
	// 'revoked' (the admin pulled it) and not yet reaped.
	const stale = await db.query.demo_links.findMany({
		where: or(
			and(eq(demo_links.status, 'active'), lte(demo_links.expires_at, new Date())),
			eq(demo_links.status, 'revoked')
		)
	});
	if (stale.length === 0) return { linksExpired: 0, usersDeactivated: 0, profilesUnenrolled: 0 };

	const demoUserIds = stale.map((l) => l.demo_user_id).filter((id): id is string => id !== null);

	let usersDeactivated = 0;
	let profilesUnenrolled = 0;
	if (demoUserIds.length > 0) {
		// Force logout + stop scraping + block API for the minted demo users.
		await db.delete(sessions).where(inArray(sessions.userId, demoUserIds));
		await db.delete(device_shares).where(inArray(device_shares.shared_with, demoUserIds));
		await db.delete(credential_shares).where(inArray(credential_shares.shared_with, demoUserIds));
		const res = await db
			.update(users)
			.set({ is_approved: false })
			// Guard with is_demo so we never touch a real account by accident.
			.where(and(inArray(users.id, demoUserIds), eq(users.is_demo, true)));
		usersDeactivated = res.rowCount ?? 0;

		// Stop the matcher scoring new jobs for a demo nobody can reach. Scoped
		// through profiles.user_id and guarded on is_demo the same way the
		// deactivation above is, so a real account is never unenrolled from its
		// own matching by a demo sweep.
		const unenrolled = await db
			.update(match_config)
			.set({ match_community_jobs: false })
			.where(
				and(
					eq(match_config.match_community_jobs, true),
					inArray(
						match_config.profile_id,
						db
							.select({ id: profiles.id })
							.from(profiles)
							.innerJoin(users, eq(users.id, profiles.user_id))
							.where(and(inArray(users.id, demoUserIds), eq(users.is_demo, true)))
					)
				)
			);
		profilesUnenrolled = unenrolled.rowCount ?? 0;
	}

	// Mark revoked links that were already expired-by-time as 'expired' too, and
	// flip the time-expired actives. (ne avoids rewriting already-expired rows.)
	const res = await db
		.update(demo_links)
		.set({ status: 'expired' })
		.where(
			and(
				inArray(
					demo_links.id,
					stale.map((l) => l.id)
				),
				ne(demo_links.status, 'expired')
			)
		);

	return { linksExpired: res.rowCount ?? 0, usersDeactivated, profilesUnenrolled };
}
