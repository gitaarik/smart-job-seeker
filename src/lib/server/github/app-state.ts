/**
 * The `state` carried through the GitHub App install round trip.
 *
 * Signed rather than stored: the callback has to prove that the browser
 * returning from GitHub is the same session that left, and a signature does
 * that without a table, a cleanup job, or a second round trip. It carries the
 * return path too, so the user lands back where they started.
 *
 * Reuses `SJS_AUTH_SECRET` — the same secret already trusted to sign session
 * cookies — rather than introducing another key to manage.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv } from '$lib/tools/get-env';

/** Long enough to finish an install, short enough that a stale link is dead. */
const MAX_AGE_MS = 30 * 60 * 1000;

function sign(payload: string): string {
	return createHmac('sha256', getEnv('SJS_AUTH_SECRET')).update(payload).digest('base64url');
}

export function signInstallState(userId: string, returnTo: string, nowMs = Date.now()): string {
	// A relative path only: a return_to pointing off-site would turn this into an
	// open redirect wearing a signature.
	const safeReturn = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
	const payload = `${nowMs}:${userId}:${safeReturn}`;
	return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;
}

export interface InstallState {
	userId: string;
	returnTo: string;
}

export function verifyInstallState(state: string, nowMs = Date.now()): InstallState | null {
	const [encoded, signature] = state.split('.');
	if (!encoded || !signature) return null;

	let payload: string;
	try {
		payload = Buffer.from(encoded, 'base64url').toString('utf8');
	} catch {
		return null;
	}

	const expected = Buffer.from(sign(payload));
	const given = Buffer.from(signature);
	if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

	const [issuedAt, userId, ...rest] = payload.split(':');
	const returnTo = rest.join(':');
	if (!userId || !issuedAt) return null;
	if (nowMs - Number(issuedAt) > MAX_AGE_MS) return null;
	return { userId, returnTo: returnTo || '/' };
}
