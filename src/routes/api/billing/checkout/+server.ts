/**
 * Billing checkout stub — not available in OSS version.
 * The cloud version overlays this with real Stripe checkout.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	error(404, 'Billing is not available in the self-hosted version.');
};
