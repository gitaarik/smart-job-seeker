import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { count, eq } from 'drizzle-orm';
import { profiles } from '$lib/server/db/schema';
import { DELETION_GRACE_DAYS, requestAccountDeletion } from '$lib/server/account/delete';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) redirect(302, '/login');

	const [{ profileCount }] = await db
		.select({ profileCount: count() })
		.from(profiles)
		.where(eq(profiles.user_id, user.id));

	return {
		email: user.email,
		profileCount,
		graceDays: DELETION_GRACE_DAYS,
		// Demo accounts are reaped by their link's TTL and have no password to
		// re-authenticate with; deleting one by hand would leave the link pointing
		// at nothing.
		isDemo: (user as { is_demo?: boolean }).is_demo === true
	};
};

export const actions: Actions = {
	request: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });
		if ((user as { is_demo?: boolean }).is_demo) {
			return fail(400, { error: 'Demo accounts expire on their own and cannot be deleted here.' });
		}

		const formData = await request.formData();
		const confirmEmail = (formData.get('confirmEmail') as string | null)?.trim();

		if (confirmEmail !== user.email) {
			return fail(400, { error: 'Email address does not match' });
		}

		await requestAccountDeletion(user.id, { by: 'user' });

		// The request revoked every session, this one included, so there is
		// nothing to redirect back into.
		redirect(303, '/deletion-pending');
	}
};
