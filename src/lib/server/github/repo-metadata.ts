/**
 * GitHub repository metadata — the deterministic tier of repo-derived project
 * evidence (`planning/SEMANTIC-MATCHING-AND-RAG.md` § Repo-derived project
 * evidence, Tier 1).
 *
 * No LLM, no clone, no extraction: one REST call that fills the fields a person
 * would otherwise copy across by hand. That is the whole point of keeping this
 * tier separate — it has no hallucination surface, costs no credits, and ships
 * without any of the machinery Tiers 2/3 need.
 *
 * Everything here is a *proposal*. Nothing in this module writes to the
 * database; the caller decides what to apply. See `proposalsFor`.
 */

import { config } from '$lib/server/config';

export class GitHubFetchError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
		this.name = 'GitHubFetchError';
	}
}

export interface RepoRef {
	owner: string;
	repo: string;
}

/** The subset of GitHub's repo payload this feature reads. */
export interface RepoMetadata extends RepoRef {
	name: string;
	description: string | null;
	homepage: string | null;
	htmlUrl: string;
	stars: number;
	/** Repo creation — the closest deterministic proxy for "project started". */
	createdAt: string;
	/** Last push. Only meaningful as an END date once the repo is archived. */
	pushedAt: string;
	archived: boolean;
	/** Dominant language, and the topics the owner declared. Not applied in
	 *  Tier 1 — carried so Tier 1b can seed technology chips without a second
	 *  round-trip. */
	language: string | null;
	topics: string[];
}

/**
 * `owner/repo` out of whatever the user pasted into the repo URL field.
 *
 * Accepts the forms that actually turn up there: the browser URL (with or
 * without a `/tree/main/...` tail), the `.git` clone URL, the SCP-style SSH
 * remote, and a bare `github.com/owner/repo`. Anything else — including other
 * forges — returns null rather than guessing, because a wrong guess here sends
 * someone else's repo metadata into this user's profile.
 */
export function parseGitHubRepoUrl(input: string): RepoRef | null {
	const trimmed = input.trim();
	if (!trimmed) return null;

	// SCP-style SSH: git@github.com:owner/repo.git
	const ssh = /^(?:ssh:\/\/)?git@github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(trimmed);
	if (ssh) return normalizeRef(ssh[1], ssh[2]);

	// Everything else goes through URL, with a scheme supplied when missing so a
	// bare `github.com/...` parses the same way as a pasted link.
	const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
	let url: URL;
	try {
		url = new URL(withScheme);
	} catch {
		return null;
	}

	const host = url.hostname.toLowerCase();
	if (host !== 'github.com' && host !== 'www.github.com') return null;

	const segments = url.pathname.split('/').filter(Boolean);
	if (segments.length < 2) return null;
	return normalizeRef(segments[0], segments[1].replace(/\.git$/i, ''));
}

/**
 * GitHub's own naming rules, applied so a typo fails here rather than as a
 * confusing 404 from the API.
 */
function normalizeRef(owner: string, repo: string): RepoRef | null {
	const validOwner = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
	const validRepo = /^[A-Za-z0-9_.-]{1,100}$/;
	if (!validOwner.test(owner) || !validRepo.test(repo)) return null;
	if (repo === '.' || repo === '..') return null;
	return { owner, repo };
}

/**
 * Fetch public repository metadata.
 *
 * Unauthenticated GitHub allows 60 requests/hour **per IP** — which is per
 * *server*, not per user, so on a shared instance that budget is gone quickly.
 * Set `SJS_GITHUB_TOKEN` (any read-only token; no scopes needed for public
 * repos) to get 5,000/hour. The rate-limit path is reported as its own message
 * because "try again" is the right advice for it and wrong for a 404.
 */
export async function fetchRepoMetadata(ref: RepoRef, signal?: AbortSignal): Promise<RepoMetadata> {
	const headers: Record<string, string> = {
		Accept: 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28',
		// GitHub rejects unidentified clients on some paths.
		'User-Agent': 'smart-job-seeker'
	};
	if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;

	let response: Response;
	try {
		response = await fetch(`https://api.github.com/repos/${ref.owner}/${ref.repo}`, {
			headers,
			signal
		});
	} catch (err) {
		throw new GitHubFetchError(`Could not reach GitHub: ${(err as Error).message}`, 502);
	}

	if (response.status === 404) {
		throw new GitHubFetchError(
			`No public repository at ${ref.owner}/${ref.repo}. Private repositories are not supported yet — upload a ZIP instead.`,
			404
		);
	}
	if (response.status === 403 || response.status === 429) {
		const remaining = response.headers.get('x-ratelimit-remaining');
		if (remaining === '0') {
			throw new GitHubFetchError(
				'GitHub rate limit reached for this server. Try again later.',
				429
			);
		}
		throw new GitHubFetchError('GitHub refused the request.', 403);
	}
	if (!response.ok) {
		throw new GitHubFetchError(`GitHub returned ${response.status}.`, 502);
	}

	const body = (await response.json()) as Record<string, unknown>;
	return {
		owner: ref.owner,
		repo: ref.repo,
		name: typeof body.name === 'string' ? body.name : ref.repo,
		description: typeof body.description === 'string' ? body.description : null,
		homepage: typeof body.homepage === 'string' && body.homepage.trim() ? body.homepage : null,
		htmlUrl:
			typeof body.html_url === 'string'
				? body.html_url
				: `https://github.com/${ref.owner}/${ref.repo}`,
		stars: typeof body.stargazers_count === 'number' ? body.stargazers_count : 0,
		createdAt: typeof body.created_at === 'string' ? body.created_at : '',
		pushedAt: typeof body.pushed_at === 'string' ? body.pushed_at : '',
		archived: body.archived === true,
		language: typeof body.language === 'string' ? body.language : null,
		topics: Array.isArray(body.topics) ? body.topics.filter((t) => typeof t === 'string') : []
	};
}

/** A `side_projects` column this feature can fill, and where the value came from. */
export interface FieldProposal {
	field: 'name' | 'url' | 'summary' | 'stars' | 'start_date' | 'end_date';
	label: string;
	/** Already in the shape the PATCH endpoint takes. */
	value: string;
	/** Provenance, shown next to the value so the user can judge it. */
	note: string;
}

/** ISO date part, or '' if GitHub gave us nothing usable. */
function isoDate(value: string): string {
	if (!value) return '';
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

/**
 * Map metadata onto proposals.
 *
 * Two deliberate omissions:
 *
 * - **`end_date` only when the repo is archived.** `pushed_at` on a live repo
 *   is "last touched", not "finished", and writing it into an end date would
 *   silently retire an ongoing project on the applicant's CV.
 * - **Empty values are dropped, not proposed as blanks.** A proposal that
 *   clears a field the user filled in is never what they wanted from a button
 *   labelled "fetch".
 */
export function proposalsFor(meta: RepoMetadata): FieldProposal[] {
	const proposals: FieldProposal[] = [];

	if (meta.name) {
		proposals.push({ field: 'name', label: 'Name', value: meta.name, note: 'Repository name' });
	}
	if (meta.description) {
		proposals.push({
			field: 'summary',
			label: 'Summary',
			value: meta.description,
			note: 'Repository description'
		});
	}
	if (meta.homepage) {
		proposals.push({
			field: 'url',
			label: 'Project URL',
			value: meta.homepage,
			note: 'Repository homepage'
		});
	}
	proposals.push({
		field: 'stars',
		label: 'Stars',
		value: String(meta.stars),
		note: 'Current star count'
	});

	const created = isoDate(meta.createdAt);
	if (created) {
		proposals.push({
			field: 'start_date',
			label: 'Start date',
			value: created,
			note: 'Repository created'
		});
	}
	// See the doc comment: a live repo has no end date to propose.
	const pushed = isoDate(meta.pushedAt);
	if (meta.archived && pushed) {
		proposals.push({
			field: 'end_date',
			label: 'End date',
			value: pushed,
			note: 'Repository archived after this push'
		});
	}

	return proposals;
}
