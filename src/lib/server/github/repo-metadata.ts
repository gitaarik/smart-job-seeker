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
import { normalizeSkill } from '$lib/skills';

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
 * One GitHub REST call, with this feature's shared headers and error mapping.
 *
 * Unauthenticated GitHub allows 60 requests/hour **per IP** — which is per
 * *server*, not per user, so on a shared instance that budget is gone quickly.
 * Set `SJS_GITHUB_TOKEN` (any read-only token; no scopes needed for public
 * repos) to get 5,000/hour. The rate-limit path is reported as its own message
 * because "try again" is the right advice for it and wrong for a 404.
 */
async function githubRequest(
	path: string,
	ref: RepoRef,
	signal?: AbortSignal
): Promise<Record<string, unknown>> {
	const headers: Record<string, string> = {
		Accept: 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28',
		// GitHub rejects unidentified clients on some paths.
		'User-Agent': 'smart-job-seeker'
	};
	if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;

	let response: Response;
	try {
		response = await fetch(`https://api.github.com${path}`, { headers, signal });
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

	return (await response.json()) as Record<string, unknown>;
}

/** Fetch public repository metadata. */
export async function fetchRepoMetadata(ref: RepoRef, signal?: AbortSignal): Promise<RepoMetadata> {
	const body = await githubRequest(`/repos/${ref.owner}/${ref.repo}`, ref, signal);
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

/**
 * Byte counts per language, e.g. `{ TypeScript: 91234, Shell: 2100 }`.
 *
 * A second call, deliberately: the repo payload's `language` is only the single
 * biggest one, so a TypeScript+Python project would claim TypeScript alone. For
 * a technology list that is the difference between right and half-right, and it
 * costs one request against a budget `SJS_GITHUB_TOKEN` fixes properly.
 */
export async function fetchRepoLanguages(
	ref: RepoRef,
	signal?: AbortSignal
): Promise<Record<string, number>> {
	const body = await githubRequest(`/repos/${ref.owner}/${ref.repo}/languages`, ref, signal);
	const languages: Record<string, number> = {};
	for (const [name, bytes] of Object.entries(body)) {
		if (typeof bytes === 'number' && bytes > 0) languages[name] = bytes;
	}
	return languages;
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

/** A technology chip this feature can add, and why. */
export interface TechnologyProposal {
	name: string;
	note: string;
	/**
	 * Whether to tick this by default. Only the repository's primary language
	 * earns it: that is a measured fact about the code. Everything else — minor
	 * languages and the owner's discovery topics — is proposed unticked, because
	 * a topic list is as likely to hold `hacktoberfest` as it is `playwright`,
	 * and no blocklist would keep up. The client drops anything already listed
	 * before applying this.
	 */
	preselect: boolean;
}

/**
 * Ignore languages below this share of the repository's bytes.
 *
 * A stray CI script should not put "Shell" on someone's CV. The cut is
 * arbitrary but the failure it prevents is not: GitHub reports every language
 * it detects, including one-file ones.
 */
const LANGUAGE_SHARE_FLOOR = 0.05;

/**
 * Tokens to upper-case when title-casing a topic.
 *
 * Deliberately short and deliberately not a taxonomy: GitHub topics are
 * lowercase-hyphenated (`telegram-bot`, `claude-code`), and title-casing gets
 * the common case right while mangling acronyms. These are the ones worth
 * hard-coding; anything else the user can fix in the chip, which is editable.
 */
const TOPIC_ACRONYMS = new Set([
	'ai',
	'api',
	'cli',
	'css',
	'html',
	'http',
	'https',
	'json',
	'llm',
	'mcp',
	'ml',
	'nlp',
	'ocr',
	'orm',
	'rest',
	'sdk',
	'sql',
	'ssh',
	'tui',
	'ui',
	'ux',
	'xml',
	'yaml'
]);

/** `telegram-bot` → `Telegram Bot`, `mcp-sdk` → `Mcp SDK`. */
function topicLabel(topic: string): string {
	return topic
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((word) =>
			TOPIC_ACRONYMS.has(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)
		)
		.join(' ');
}

/**
 * Technology chips a repository can justify: its languages, then its topics.
 *
 * Deduped against each other by the matching pipeline's own rule, so a
 * `typescript` topic does not arrive next to the `TypeScript` language. The
 * caller dedupes against what the project already lists.
 */
export function technologyProposalsFor(
	meta: RepoMetadata,
	languages: Record<string, number>
): TechnologyProposal[] {
	const proposals: TechnologyProposal[] = [];
	const seen = new Set<string>();

	const add = (name: string, note: string, preselect: boolean) => {
		const key = normalizeSkill(name);
		if (!key || seen.has(key)) return;
		seen.add(key);
		proposals.push({ name, note, preselect });
	};

	const ranked = Object.entries(languages).sort(([, a], [, b]) => b - a);
	const totalBytes = ranked.reduce((sum, [, bytes]) => sum + bytes, 0);
	ranked.forEach(([name, bytes], index) => {
		const share = totalBytes > 0 ? bytes / totalBytes : 0;
		// The top language is kept whatever its share — a repository is written in
		// something, even when the byte counts are spread thin.
		if (index > 0 && share < LANGUAGE_SHARE_FLOOR) return;
		add(
			name,
			index === 0 ? 'Primary language' : `Language, ${Math.round(share * 100)}% of the code`,
			index === 0
		);
	});

	// `/languages` can come back empty (an empty repo, or one of only unrecognized
	// files); the repo payload's own field is the fallback.
	if (ranked.length === 0 && meta.language) add(meta.language, 'Primary language', true);

	for (const topic of meta.topics) add(topicLabel(topic), 'GitHub topic', false);

	return proposals;
}
