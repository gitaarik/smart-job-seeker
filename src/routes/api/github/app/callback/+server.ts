/**
 * Where GitHub returns after an install.
 *
 * ## Why this does an OAuth exchange rather than trusting the query string
 *
 * `state` proves the browser is the signed-in user who started an install. It
 * proves nothing whatsoever about `installation_id`, which arrives as a plain
 * query parameter and is a low-entropy, enumerable integer. And the app JWT can
 * read *any* installation of this app — that is what being the app means — so
 * confirming the id with it confirms only that it exists.
 *
 * Trusting the id on that basis would be installation hijacking: an attacker
 * signs in, starts an install to mint a valid `state` for their own account,
 * then hand-crafts a callback carrying someone else's `installation_id`. The
 * row would bind the victim's installation to the attacker's user, and the next
 * scan would mint a real token for it and read the victim's private repositories.
 *
 * So the id has to be checked against something only the rightful owner can
 * produce: a user-to-server token. `GET /user/installations` is scoped to that
 * token's own GitHub account, and an id missing from it is one they do not
 * control. This requires "Request user authorization (OAuth) during
 * installation" on the app, which is why the code below **fails closed** when
 * no `code` arrives rather than falling back to the unverified path.
 */
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/utils/api-helpers';
import {
	createAppJwt,
	exchangeUserCode,
	isGitHubAppConfigured,
	saveInstallation,
	userInstallationIds
} from '$lib/server/github/app-auth';
import { verifyInstallState } from '$lib/server/github/app-state';

/** The account an installation sits on, straight from GitHub. */
async function fetchInstallationAccount(installationId: number) {
	const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
		headers: {
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'User-Agent': 'smart-job-seeker',
			Authorization: `Bearer ${createAppJwt(Math.floor(Date.now() / 1000))}`
		}
	});
	if (!response.ok) return null;
	const body = (await response.json()) as { account?: { login?: string; type?: string } };
	return { login: body.account?.login ?? null, type: body.account?.type ?? null };
}

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requireAuth(locals);
	if (!isGitHubAppConfigured()) error(503, 'GitHub is not connected on this server yet.');

	const state = url.searchParams.get('state') ?? '';
	const verified = verifyInstallState(state);
	// A mismatched user means this callback belongs to a different session —
	// treat it as forged rather than as a login prompt.
	if (!verified || verified.userId !== user.id) error(400, 'That GitHub link has expired.');

	const installationId = Number(url.searchParams.get('installation_id'));
	if (!Number.isInteger(installationId) || installationId <= 0) {
		// GitHub also sends people here after a "request" on an org they cannot
		// install to themselves. Nothing to record; send them back quietly.
		redirect(302, verified.returnTo);
	}

	// --- the ownership proof; see the note at the top of this file ---
	const code = url.searchParams.get('code') ?? '';
	if (!code) {
		error(
			400,
			'GitHub did not confirm who you are. The app needs “Request user authorization (OAuth) during installation” enabled.'
		);
	}
	const userToken = await exchangeUserCode(code);
	if (!userToken) error(502, 'GitHub did not confirm who you are. Try again.');

	const reachable = await userInstallationIds(userToken);
	if (!reachable.includes(installationId)) {
		// Either a forged id, or a genuine race where GitHub has not yet published
		// the installation to the user. Same answer either way: do not store it.
		error(403, 'That installation is not one your GitHub account can access.');
	}

	const account = await fetchInstallationAccount(installationId);
	if (!account) error(502, 'GitHub did not confirm that installation. Try again.');

	await saveInstallation(user.id, installationId, account);
	redirect(302, verified.returnTo);
};
