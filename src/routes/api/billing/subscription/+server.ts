/**
 * Subscription info — OSS version (always free plan).
 * The cloud version overlays this with real subscription data.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBalance } from '$lib/server/billing/credits';
import { getActiveSubscription } from '$lib/server/billing/subscription';

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) error(401, 'Not authenticated');

	const [creditBalance, subscription] = await Promise.all([
		getBalance(user.id),
		getActiveSubscription(user.id)
	]);

	return json({ creditBalance, subscription });
};
