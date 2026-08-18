/**
 * Start the GitHub App install flow.
 *
 * Redirects to GitHub's own installation screen, which is where the user picks
 * which repositories to grant. We cannot preselect "only select repositories"
 * — GitHub defaults that radio to "all" — so the UI that links here is
 * responsible for saying so before the user leaves.
 *
 * `state` is an HMAC over the user id, checked on the way back. Without it the
 * callback would accept an installation id from anyone, letting an attacker
 * attach *their* installation to someone else's account — or, more likely,
 * letting a stale link attach an installation to the wrong session.
 */
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { appInstallUrl, isGitHubAppConfigured } from '$lib/server/github/app-auth';
import { signInstallState } from '$lib/server/github/app-state';

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requireAuth(locals);
	if (!isGitHubAppConfigured()) {
		error(503, 'GitHub is not connected on this server yet.');
	}

	// Where to send them once GitHub bounces back.
	const returnTo = url.searchParams.get('return_to') || '/profile/side-projects';
	const target = appInstallUrl(signInstallState(user.id, returnTo));
	if (!target) error(503, 'GitHub is not connected on this server yet.');
	redirect(302, target);
};
