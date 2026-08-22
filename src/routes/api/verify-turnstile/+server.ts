import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyTurnstileToken } from '$lib/server/auth/turnstile';

/**
 * Client-facing token check, used by the public contact-info reveal.
 *
 * Note what this endpoint is and is not: it tells the caller whether a token
 * is good. It does not protect anything by itself, because whatever the caller
 * does next is the caller's choice. Registration is gated in `better-auth.ts`
 * instead, on the endpoint rather than in front of it.
 */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let token: string | undefined;
	try {
		token = (await request.json()).token;
	} catch {
		return json({ success: false, error: 'Invalid request body' }, { status: 400 });
	}

	if (!token) {
		return json({ success: false, error: 'No token provided' }, { status: 400 });
	}

	const result = await verifyTurnstileToken(token, getClientAddress());

	if (!result.success) {
		return json(
			{
				success: false,
				error: 'Turnstile verification failed',
				'error-codes': result.errorCodes ?? []
			},
			{ status: 400 }
		);
	}

	return json({
		success: true,
		challenge_ts: result.challengeTs,
		hostname: result.hostname
	});
};
