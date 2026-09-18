/**
 * Shared API route helpers for auth and ID parsing
 */

import { error } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import { profiles } from '$lib/server/db/schema';
import { isStaffViewer } from '$lib/server/auth/guards';

/**
 * Require authenticated user from locals, or throw 401.
 */
export function requireAuth(locals: App.Locals): App.Locals['user'] & {} {
	const user = locals.user;
	if (!user) {
		error(401, 'Not authenticated');
	}
	return user;
}

/**
 * Require a staff (or admin) viewer, or throw 403.
 *
 * The API-side twin of `requireAdmin` in auth/guards.ts, for the endpoints
 * behind a staff-only control: it asks `isStaffViewer`, the same predicate the
 * page uses to decide whether to render the button, so the door and the button
 * cannot drift apart. They had — /jobs/[id] shows its Rescrape tool to staff
 * while the endpoint behind it asked only for a session, which let any signed-in
 * caller drive the scraper against any job id.
 *
 * Throws rather than redirecting, because these are reached by `fetch`, and a
 * 302 to /home comes back as a 200 with a page in it.
 */
export function requireStaff(locals: App.Locals): App.Locals['user'] & {} {
	const user = requireAuth(locals);
	if (!isStaffViewer(locals)) {
		error(403, 'Staff access required');
	}
	return user;
}

/**
 * Parse an integer route param, or throw 400.
 */
export function parseIntParam(value: string, label: string): number {
	const parsed = parseInt(value, 10);
	if (isNaN(parsed)) {
		error(400, `Invalid ${label} ID`);
	}
	return parsed;
}

/**
 * Verify that a profile belongs to the given user, or throw 403.
 */
export async function requireProfileAccess(profileId: number, userId: string): Promise<void> {
	const profile = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profileId), eq(profiles.user_id, userId)),
		columns: { id: true }
	});
	if (!profile) {
		error(403, 'Not authorized');
	}
}
