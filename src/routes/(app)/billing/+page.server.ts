/**
 * Billing page — OSS version (free tier info only).
 * The cloud version overlays this with full plan/subscription management.
 */

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getBalance } from '#lib/server/billing/credits.ts';
import { getPlans } from '#lib/server/billing/plans.ts';
import { getActiveSubscription } from '#lib/server/billing/subscription.ts';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) redirect(302, '/auth/login');

	const [subscription, creditBalance] = await Promise.all([
		getActiveSubscription(user.id),
		getBalance(user.id)
	]);

	return {
		subscription,
		plans: getPlans(),
		creditBalance,
		stripePublishableKey: ''
	};
};
