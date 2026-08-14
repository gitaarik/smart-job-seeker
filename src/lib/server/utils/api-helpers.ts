/**
 * Shared API route helpers for auth and ID parsing
 */

import { error } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import { profiles } from '$lib/server/db/schema';

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
