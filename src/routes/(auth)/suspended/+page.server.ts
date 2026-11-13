import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) redirect(302, '/login');

	// The reason is not on the session, so read it with the date it belongs to.
	const row = await db.query.users.findFirst({
		where: eq(users.id, user.id),
		columns: { suspended_at: true, suspended_reason: true }
	});
	// Not suspended: this page has nothing to say, and the guard that sends
	// people here would not have.
	if (!row?.suspended_at) redirect(302, '/home');

	return {
		suspendedAt: row.suspended_at,
		reason: row.suspended_reason,
		supportEmail: process.env.SJS_ADMIN_EMAIL || null
	};
};
