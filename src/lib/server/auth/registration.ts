/**
 * Whether this environment accepts new registrations.
 *
 * Opening registration used to be a property of the *code*: `(auth)/signup`
 * returned `redirect(302, '/login')`, so the only way to open it anywhere was
 * to ship a release that opened it everywhere. That is a bad shape for the one
 * decision most worth making per-environment and reversing quickly — and
 * `preview` serves `www`, so "deploy it to preview to try it" and "launch it
 * publicly" were the same action.
 *
 * As a flag, the release is safe to deploy anywhere and opening the doors is a
 * config change on one box.
 *
 * **Defaults to closed.** A deploy that forgets to set it turns registration
 * off, which is recoverable; the other default silently opens a signup form to
 * the internet on an environment nobody meant to launch.
 */

import { getEnv } from '$lib/tools/get-env';

export function registrationOpen(): boolean {
	const raw = String(getEnv('SJS_REGISTRATION_OPEN', 'false')).trim().toLowerCase();
	return raw === 'true' || raw === '1' || raw === 'yes';
}

/**
 * Whether a public signup is approved when it is created, instead of waiting
 * for an admin. `SJS_REGISTRATION_APPROVAL=auto`; anything else is manual.
 *
 * Approving at creation is approving at verification in practice: with
 * `requireEmailVerification` nobody signs in before following the link, so an
 * address nobody receives at never gets in. It applies only to signups over
 * HTTP (`approvesOnSignup` in `signup-gate.ts`); invites and demo accounts set
 * `is_approved` themselves, and an admin can still un-approve or suspend.
 *
 * **Defaults to manual**, for the same reason the flag above defaults to
 * closed: a mistyped value should leave people waiting, not let them in.
 */
export function autoApproveSignups(): boolean {
	const raw = String(getEnv('SJS_REGISTRATION_APPROVAL', 'manual')).trim().toLowerCase();
	return raw === 'auto';
}
