/**
 * The repositories this user granted us, for the editor's repo picker.
 *
 * The payoff for the app route over a pasted token: rather than asking someone
 * to find and paste a URL, the editor can list exactly what they chose to
 * share. An empty list is a normal state — it means "not connected yet", which
 * the UI reports as an invitation rather than an error.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/utils/api-helpers';
import {
	isGitHubAppConfigured,
	listAccessibleRepos,
	listInstallations
} from '$lib/server/github/app-auth';

export const GET: RequestHandler = async ({ locals }) => {
	const user = requireAuth(locals);
	if (!isGitHubAppConfigured()) {
		return json({ available: false, connected: false, repos: [] });
	}
	const installations = await listInstallations(user.id);
	const repos = await listAccessibleRepos(user.id, Date.now());
	return json({ available: true, connected: installations.length > 0, repos });
};
