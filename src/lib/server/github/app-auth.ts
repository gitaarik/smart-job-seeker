/**
 * GitHub App authentication — how a user grants read access to their own
 * private repositories.
 *
 * The chain is: our app private key → a short-lived JWT → an installation
 * access token → one API call. Only the first link is stored, and it lives in
 * the environment rather than the database, so a database leak on its own
 * yields nothing usable. Installation tokens last an hour, are minted on
 * demand, and are never persisted.
 *
 * Everything here no-ops when the app is not configured: `SJS_GITHUB_APP_ID`
 * and its key are unset until the app is registered, and the repo features are
 * expected to degrade to public-repos-only rather than fail.
 */

import { createSign } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { github_app_installations } from '$lib/server/db/schema';
import { config } from '$lib/server/config';

export function isGitHubAppConfigured(): boolean {
	return !!(config.githubAppId && config.githubAppPrivateKey);
}

/** Where to send someone to install it, or null if there is no app yet. */
export function appInstallUrl(state: string): string | null {
	if (!config.githubAppSlug) return null;
	return `https://github.com/apps/${config.githubAppSlug}/installations/new?state=${encodeURIComponent(state)}`;
}

function privateKeyPem(): string {
	const raw = config.githubAppPrivateKey;
	// Accept a base64 blob (what the env var is meant to hold) or a pasted PEM,
	// because someone will eventually paste the PEM and a confusing crypto error
	// is a bad way to find that out.
	if (raw.includes('BEGIN')) return raw;
	return Buffer.from(raw, 'base64').toString('utf8');
}

/**
 * A JWT proving we are the app.
 *
 * RS256, signed with the app private key. `iat` is backdated 60s because
 * GitHub rejects a token whose issue time is ahead of its own clock, and a
 * server a few seconds fast is the common way that happens.
 */
export function createAppJwt(nowSeconds: number): string {
	const header = { alg: 'RS256', typ: 'JWT' };
	const payload = {
		iat: nowSeconds - 60,
		// GitHub caps this at 10 minutes; 9 leaves room for clock skew.
		exp: nowSeconds + 9 * 60,
		iss: config.githubAppId
	};
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
	const signingInput = `${encode(header)}.${encode(payload)}`;

	const signer = createSign('RSA-SHA256');
	signer.update(signingInput);
	signer.end();
	const signature = signer.sign(privateKeyPem()).toString('base64url');
	return `${signingInput}.${signature}`;
}

interface CachedToken {
	token: string;
	expiresAt: number;
}

/**
 * Installation tokens, held in memory only.
 *
 * Reused while valid so a scan that makes three API calls mints once. Expiry is
 * treated as a minute early: a token that dies mid-request would surface as a
 * confusing 401 rather than as the expiry it is. In-process, so it does not
 * survive a restart and is not shared between app instances — both fine, since
 * the cost of a miss is one extra HTTP call.
 */
const tokenCache = new Map<number, CachedToken>();

export async function installationToken(
	installationId: number,
	nowMs: number
): Promise<string | null> {
	if (!isGitHubAppConfigured()) return null;

	const cached = tokenCache.get(installationId);
	if (cached && cached.expiresAt - 60_000 > nowMs) return cached.token;

	const response = await fetch(
		`https://api.github.com/app/installations/${installationId}/access_tokens`,
		{
			method: 'POST',
			headers: {
				Accept: 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28',
				'User-Agent': 'smart-job-seeker',
				Authorization: `Bearer ${createAppJwt(Math.floor(nowMs / 1000))}`
			}
		}
	);
	if (!response.ok) {
		// A revoked or uninstalled app 404s here. That is not an error state worth
		// throwing over — the caller falls back to unauthenticated access, which
		// still works for public repositories.
		tokenCache.delete(installationId);
		return null;
	}

	const body = (await response.json()) as { token?: string; expires_at?: string };
	if (!body.token) return null;
	const expiresAt = body.expires_at ? Date.parse(body.expires_at) : nowMs + 3_600_000;
	tokenCache.set(installationId, { token: body.token, expiresAt });
	return body.token;
}

/** Forget a cached token — for when an installation is removed. */
export function forgetInstallationToken(installationId: number): void {
	tokenCache.delete(installationId);
}

export interface StoredInstallation {
	installationId: number;
	accountLogin: string | null;
}

export async function listInstallations(userId: string): Promise<StoredInstallation[]> {
	const rows = await db.query.github_app_installations.findMany({
		where: eq(github_app_installations.user_id, userId),
		columns: { installation_id: true, account_login: true }
	});
	return rows.map((r) => ({ installationId: r.installation_id, accountLogin: r.account_login }));
}

export async function saveInstallation(
	userId: string,
	installationId: number,
	account: { login?: string | null; type?: string | null }
): Promise<void> {
	const now = new Date();
	await db
		.insert(github_app_installations)
		.values({
			user_id: userId,
			installation_id: installationId,
			account_login: account.login ?? null,
			account_type: account.type ?? null,
			date_created: now,
			date_updated: now
		})
		.onConflictDoUpdate({
			target: [github_app_installations.user_id, github_app_installations.installation_id],
			set: {
				account_login: account.login ?? null,
				account_type: account.type ?? null,
				date_updated: now
			}
		});
}

export async function removeInstallation(userId: string, installationId: number): Promise<void> {
	await db
		.delete(github_app_installations)
		.where(
			and(
				eq(github_app_installations.user_id, userId),
				eq(github_app_installations.installation_id, installationId)
			)
		);
	forgetInstallationToken(installationId);
}

/**
 * A token that can read `owner/repo` on this user's behalf, or null.
 *
 * Matched by account login rather than by asking GitHub which repositories each
 * installation covers: an installation lives on exactly one account, a repo's
 * owner IS that account, so the match is exact and costs no API call. The
 * consequence is that granting access through an org installation requires the
 * org login to match the repo owner, which it does by construction.
 *
 * Null is a normal answer, not a failure — it means "no installation covers
 * this", and the caller proceeds unauthenticated, which is correct for a public
 * repository.
 */
export async function tokenForRepo(
	userId: string,
	owner: string,
	nowMs: number
): Promise<string | null> {
	if (!isGitHubAppConfigured()) return null;
	const installations = await listInstallations(userId);
	const match = installations.find((i) => i.accountLogin?.toLowerCase() === owner.toLowerCase());
	if (!match) return null;
	return installationToken(match.installationId, nowMs);
}

export interface InstallationRepo {
	fullName: string;
	name: string;
	owner: string;
	isPrivate: boolean;
	defaultBranch: string;
}

/**
 * The repositories a user actually granted, across all their installations.
 *
 * This is the payoff for the app route over a pasted token: the editor can
 * offer a list to pick from instead of asking for a URL, and the list is
 * exactly what they chose to share.
 */
export async function listAccessibleRepos(
	userId: string,
	nowMs: number
): Promise<InstallationRepo[]> {
	const installations = await listInstallations(userId);
	const repos: InstallationRepo[] = [];
	const seen = new Set<string>();

	for (const installation of installations) {
		const token = await installationToken(installation.installationId, nowMs);
		if (!token) continue;
		const response = await fetch('https://api.github.com/installation/repositories?per_page=100', {
			headers: {
				Accept: 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28',
				'User-Agent': 'smart-job-seeker',
				Authorization: `Bearer ${token}`
			}
		});
		if (!response.ok) continue;
		const body = (await response.json()) as { repositories?: unknown };
		if (!Array.isArray(body.repositories)) continue;
		for (const raw of body.repositories) {
			const repo = raw as Record<string, unknown>;
			const fullName = typeof repo.full_name === 'string' ? repo.full_name : '';
			if (!fullName || seen.has(fullName)) continue;
			seen.add(fullName);
			repos.push({
				fullName,
				name: typeof repo.name === 'string' ? repo.name : (fullName.split('/')[1] ?? ''),
				owner: fullName.split('/')[0] ?? '',
				isPrivate: repo.private === true,
				defaultBranch: typeof repo.default_branch === 'string' ? repo.default_branch : 'HEAD'
			});
		}
	}

	// Private first: they are the ones that could not be reached any other way,
	// so they are what someone who just connected is looking for.
	return repos.sort(
		(a, b) => Number(b.isPrivate) - Number(a.isPrivate) || a.fullName.localeCompare(b.fullName)
	);
}
