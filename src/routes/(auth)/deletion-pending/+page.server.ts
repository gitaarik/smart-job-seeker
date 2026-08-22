import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { DELETION_GRACE_DAYS } from '$lib/server/account/delete';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) redirect(302, '/login');

	const requestedAt = (user as { deletion_requested_at?: Date | null }).deletion_requested_at;
	// Nothing pending — this page has nothing to say, and the guard that sends
	// people here would not have.
	if (!requestedAt) redirect(302, '/home');

	const scheduledFor = new Date(requestedAt);
	scheduledFor.setDate(scheduledFor.getDate() + DELETION_GRACE_DAYS);

	return {
		requestedAt,
		scheduledFor,
		supportEmail: process.env.SJS_ADMIN_EMAIL || null
	};
};
