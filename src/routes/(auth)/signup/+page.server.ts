import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { redirectIfAuthenticated } from '$lib/server/auth/guards';
import { turnstileConfigured, turnstileSiteKey } from '$lib/server/auth/turnstile';
import { registrationOpen } from '$lib/server/auth/registration';

/**
 * Registration is open.
 *
 * This route used to be `redirect(302, '/login')` — the form below it was
 * complete the whole time, and that one line was the entire reason SJS was
 * invite-only. What replaces it is not "anyone can use the product": a new
 * account lands with `is_approved = false` and waits, which is the same gate
 * that has always existed, now reached by signing up rather than by being
 * invited. See `planning/GO-LIVE.md` for why the two were split.
 *
 * Whether it is open at all is `SJS_REGISTRATION_OPEN`, per environment and
 * defaulting to closed — the redirect below is what an environment that has
 * not opened its doors still does. That is presentation; the refusal that
 * counts is on the endpoint, in `better-auth.ts`.
 */
export const load: PageServerLoad = async (event) => {
	redirectIfAuthenticated(event, '/home');
	if (!registrationOpen()) redirect(302, '/login');

	return {
		turnstileSiteKey: turnstileSiteKey(),
		turnstileEnabled: turnstileConfigured()
	};
};
