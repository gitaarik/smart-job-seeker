import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { count, eq } from 'drizzle-orm';
import { profiles } from '$lib/server/db/schema';
import {
	DELETION_GRACE_DAYS,
	requestAccountDeletion,
	SubscriptionCancelError
} from '$lib/server/account/delete';
import { getBalance } from '$lib/server/billing/credits';
import { getExtraUsage } from '$lib/server/billing/plans';
import { getActiveSubscription } from '$lib/server/billing/subscription';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) redirect(302, '/login');

	const [{ profileCount }] = await db
		.select({ profileCount: count() })
		.from(profiles)
		.where(eq(profiles.user_id, user.id));

	// Deleting ends a paid subscription on the spot with nothing refunded, so
	// the page says so before the button. Grants have no `sub_` id and cost
	// nothing to lose.
	const subscription = await getActiveSubscription(user.id);
	const paidUntil = subscription.stripeSubscriptionId?.startsWith('sub_')
		? subscription.currentPeriodEnd
		: null;

	// Extra usage that was bought and not spent goes with the account too.
	// Shown in euros, the way it was sold; the user never sees a credit.
	const extraUsage = getExtraUsage();
	const { extra } = await getBalance(user.id);
	const extraUsageLeft =
		extraUsage && extra > 0 ? `€${(extra / extraUsage.creditsPerEuro).toFixed(2)}` : null;

	return {
		email: user.email,
		profileCount,
		paidUntil,
		extraUsageLeft,
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

		try {
			await requestAccountDeletion(user.id, { by: 'user' });
		} catch (err) {
			if (!(err instanceof SubscriptionCancelError)) throw err;
			console.error('[account-delete] subscription cancel failed', err.cause);
			return fail(503, {
				error:
					'We could not cancel your subscription just now, so your account has not been deleted. Please try again in a few minutes.'
			});
		}

		// The request revoked every session, this one included, so there is
		// nothing to redirect back into.
		redirect(303, '/deletion-pending');
	}
};
