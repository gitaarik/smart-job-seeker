/**
 * Stripe webhook stub — not available in OSS version.
 * The cloud version overlays this with real webhook handling.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	error(404, 'Stripe webhooks are not available in the self-hosted version.');
};
