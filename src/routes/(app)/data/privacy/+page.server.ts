import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';

/**
 * The one privacy choice the app leaves to the person: whether our own
 * analytics may link their visits to their account.
 *
 * Everything else the site does on a device is login and preferences, and
 * the analytics without this link are anonymous statistics on our own
 * server, so nothing here needs a banner. The link is the part the Dutch
 * analytics exemption does not cover, which is why it is off until they
 * turn it on. See users.analytics_consented_at.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) redirect(302, '/login');

	// The session copy can lag a toggle by a request; the row is the truth.
	const row = await db.query.users.findFirst({
		where: eq(users.id, user.id),
		columns: { analytics_consented_at: true }
	});

	return {
		analyticsConsentedAt: row?.analytics_consented_at ?? null
	};
};

export const actions: Actions = {
	analytics: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const enabled = formData.get('enabled') === 'on';

		await db
			.update(users)
			.set({ analytics_consented_at: enabled ? new Date() : null })
			.where(eq(users.id, user.id));

		return { saved: true, enabled };
	}
};
