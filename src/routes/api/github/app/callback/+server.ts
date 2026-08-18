/**
 * Where GitHub returns after an install.
 *
 * Records the installation id against the user and sends them back where they
 * started. The account login is read back from GitHub rather than trusted from
 * the query string, because it is what repository access is matched on later —
 * a wrong login there would silently point a scan at the wrong installation.
 */
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { createAppJwt, isGitHubAppConfigured, saveInstallation } from '$lib/server/github/app-auth';
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

	const account = await fetchInstallationAccount(installationId);
	if (!account) error(502, 'GitHub did not confirm that installation. Try again.');

	await saveInstallation(user.id, installationId, account);
	redirect(302, verified.returnTo);
};
