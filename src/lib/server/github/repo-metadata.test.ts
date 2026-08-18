import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	fetchRepoArchive,
	fetchRepoHeadSha,
	fetchRepoLanguages,
	fetchRepoMetadata,
	GitHubFetchError,
	parseGitHubRepoUrl,
	MAX_ARCHIVE_BYTES,
	proposalsFor,
	technologyProposalsFor,
	type RepoMetadata
} from './repo-metadata';

const h = vi.hoisted(() => ({ config: { githubToken: '' } }));
vi.mock('$lib/server/config', () => ({ config: h.config }));

describe('parseGitHubRepoUrl', () => {
	it('accepts the forms that turn up in the repo URL field', () => {
		const expected = { owner: 'gitaarik', repo: 'sjs-browser' };
		for (const input of [
			'https://github.com/gitaarik/sjs-browser',
			'https://github.com/gitaarik/sjs-browser/',
			'https://github.com/gitaarik/sjs-browser.git',
			'http://github.com/gitaarik/sjs-browser',
			'https://www.github.com/gitaarik/sjs-browser',
			'github.com/gitaarik/sjs-browser',
			'  https://github.com/gitaarik/sjs-browser  ',
			'https://github.com/gitaarik/sjs-browser/tree/main/src',
			'git@github.com:gitaarik/sjs-browser.git',
			'ssh://git@github.com/gitaarik/sjs-browser.git'
		]) {
			expect(parseGitHubRepoUrl(input), input).toEqual(expected);
		}
	});

	it('refuses anything that is not a GitHub repo, rather than guessing', () => {
		for (const input of [
			'',
			'   ',
			'https://gitlab.com/owner/repo',
			'https://example.com/gitaarik/sjs-browser',
			// A lookalike host — the check must be the hostname, not a substring.
			'https://github.com.evil.example/owner/repo',
			'https://github.com/gitaarik',
			'https://github.com/',
			'not a url at all',
			// Invalid owner/repo names GitHub would 404 on anyway.
			'https://github.com/-bad/repo',
			'https://github.com/owner/..'
		]) {
			expect(parseGitHubRepoUrl(input), input).toBeNull();
		}
	});
});

const apiBody = (overrides: Record<string, unknown> = {}) => ({
	name: 'sjs-browser',
	description: 'Self-hosted browser for Smart Job Seeker',
	homepage: 'https://smartjobseeker.com',
	html_url: 'https://github.com/gitaarik/sjs-browser',
	stargazers_count: 42,
	created_at: '2026-01-15T10:00:00Z',
	pushed_at: '2026-08-14T09:30:00Z',
	archived: false,
	language: 'TypeScript',
	topics: ['scraping', 'playwright'],
	...overrides
});

const ref = { owner: 'gitaarik', repo: 'sjs-browser' };

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
	const response = {
		status,
		ok: status >= 200 && status < 300,
		json: async () => body,
		headers: { get: (k: string) => headers[k.toLowerCase()] ?? null }
	};
	return vi.fn().mockResolvedValue(response);
}

describe('fetchRepoMetadata', () => {
	beforeEach(() => {
		h.config.githubToken = '';
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('maps the payload onto the fields this feature reads', async () => {
		vi.stubGlobal('fetch', mockFetch(200, apiBody()));
		const meta = await fetchRepoMetadata(ref);
		expect(meta).toMatchObject({
			owner: 'gitaarik',
			repo: 'sjs-browser',
			name: 'sjs-browser',
			description: 'Self-hosted browser for Smart Job Seeker',
			homepage: 'https://smartjobseeker.com',
			stars: 42,
			archived: false,
			language: 'TypeScript',
			topics: ['scraping', 'playwright']
		});
	});

	it('survives a payload with nulls and missing keys', async () => {
		vi.stubGlobal(
			'fetch',
			mockFetch(200, { description: null, homepage: '', stargazers_count: null })
		);
		const meta = await fetchRepoMetadata(ref);
		expect(meta.description).toBeNull();
		// An empty-string homepage is not a URL; it must not become one.
		expect(meta.homepage).toBeNull();
		expect(meta.stars).toBe(0);
		expect(meta.name).toBe('sjs-browser'); // falls back to the ref
		expect(meta.htmlUrl).toBe('https://github.com/gitaarik/sjs-browser');
	});

	it('sends the token only when one is configured', async () => {
		const noToken = mockFetch(200, apiBody());
		vi.stubGlobal('fetch', noToken);
		await fetchRepoMetadata(ref);
		expect(noToken.mock.calls[0][1].headers.Authorization).toBeUndefined();

		h.config.githubToken = 'ghp_test';
		const withToken = mockFetch(200, apiBody());
		vi.stubGlobal('fetch', withToken);
		await fetchRepoMetadata(ref);
		expect(withToken.mock.calls[0][1].headers.Authorization).toBe('Bearer ghp_test');
	});

	it('tells a missing repo apart from an exhausted rate limit', async () => {
		vi.stubGlobal('fetch', mockFetch(404, {}));
		await expect(fetchRepoMetadata(ref)).rejects.toMatchObject({ status: 404 });

		vi.stubGlobal('fetch', mockFetch(403, {}, { 'x-ratelimit-remaining': '0' }));
		await expect(fetchRepoMetadata(ref)).rejects.toMatchObject({ status: 429 });

		// A 403 that is NOT the rate limit must not advise "try again later".
		vi.stubGlobal('fetch', mockFetch(403, {}, { 'x-ratelimit-remaining': '58' }));
		await expect(fetchRepoMetadata(ref)).rejects.toMatchObject({ status: 403 });
	});

	it('reports a network failure as a gateway error, not a crash', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
		const err = await fetchRepoMetadata(ref).catch((e) => e);
		expect(err).toBeInstanceOf(GitHubFetchError);
		expect(err.status).toBe(502);
	});
});

const meta = (overrides: Partial<RepoMetadata> = {}): RepoMetadata => ({
	owner: 'gitaarik',
	repo: 'sjs-browser',
	name: 'sjs-browser',
	description: 'Self-hosted browser',
	homepage: 'https://smartjobseeker.com',
	htmlUrl: 'https://github.com/gitaarik/sjs-browser',
	stars: 42,
	createdAt: '2026-01-15T10:00:00Z',
	pushedAt: '2026-08-14T09:30:00Z',
	archived: false,
	isPrivate: false,
	defaultBranch: 'main',
	language: 'TypeScript',
	topics: [],
	...overrides
});

describe('proposalsFor', () => {
	const byField = (m: RepoMetadata) => Object.fromEntries(proposalsFor(m).map((p) => [p.field, p]));

	it('proposes the fields GitHub can answer', () => {
		const fields = byField(meta());
		expect(fields.name.value).toBe('sjs-browser');
		expect(fields.summary.value).toBe('Self-hosted browser');
		expect(fields.url.value).toBe('https://smartjobseeker.com');
		expect(fields.stars.value).toBe('42');
		expect(fields.start_date.value).toBe('2026-01-15');
	});

	it('never proposes an end date for a live repo', () => {
		// pushed_at on an active repo means "last touched", not "finished" —
		// proposing it would retire an ongoing project on the CV.
		expect(byField(meta()).end_date).toBeUndefined();
		expect(byField(meta({ archived: true })).end_date.value).toBe('2026-08-14');
	});

	it('drops empty values instead of proposing blanks', () => {
		const fields = byField(meta({ description: null, homepage: null, createdAt: '' }));
		expect(fields.summary).toBeUndefined();
		expect(fields.url).toBeUndefined();
		expect(fields.start_date).toBeUndefined();
		// Zero stars is a fact, not a blank.
		expect(byField(meta({ stars: 0 })).stars.value).toBe('0');
	});

	it('ignores an unparseable date rather than emitting Invalid Date', () => {
		expect(byField(meta({ createdAt: 'not-a-date' })).start_date).toBeUndefined();
	});
});

describe('fetchRepoLanguages', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('keeps positive byte counts and drops anything else', async () => {
		vi.stubGlobal('fetch', mockFetch(200, { TypeScript: 9000, Shell: 0, Makefile: 'lots' }));
		expect(await fetchRepoLanguages(ref)).toEqual({ TypeScript: 9000 });
	});

	it('shares the repo error mapping', async () => {
		vi.stubGlobal('fetch', mockFetch(403, {}, { 'x-ratelimit-remaining': '0' }));
		await expect(fetchRepoLanguages(ref)).rejects.toMatchObject({ status: 429 });
	});
});

describe('technologyProposalsFor', () => {
	const names = (m: RepoMetadata, langs: Record<string, number>) =>
		technologyProposalsFor(m, langs).map((t) => t.name);

	it('ticks only the primary language', () => {
		const proposals = technologyProposalsFor(meta({ topics: ['playwright'] }), {
			TypeScript: 9000,
			Python: 1000
		});
		expect(proposals.map((t) => [t.name, t.preselect])).toEqual([
			['TypeScript', true],
			['Python', false],
			['Playwright', false]
		]);
		expect(proposals[0].note).toBe('Primary language');
		expect(proposals[1].note).toBe('Language, 10% of the code');
	});

	it('drops a trace language but never the top one', () => {
		// A one-file CI script must not put "Shell" on a CV.
		expect(names(meta(), { TypeScript: 99_000, Shell: 100 })).toEqual(['TypeScript']);
		// Even a repo that is 100% one trace-sized language still names it.
		expect(names(meta(), { Shell: 40 })).toEqual(['Shell']);
	});

	it('falls back to the repo payload language when /languages is empty', () => {
		expect(names(meta({ language: 'Rust' }), {})).toEqual(['Rust']);
		expect(names(meta({ language: null }), {})).toEqual([]);
	});

	it('does not propose a topic that repeats a language', () => {
		// Deduped by the matching pipeline's own rule, so "type-script" collides.
		expect(
			names(meta({ topics: ['typescript', 'type-script', 'mcp'] }), { TypeScript: 900 })
		).toEqual(['TypeScript', 'MCP']);
	});

	it('title-cases topics, upper-casing the acronyms worth hard-coding', () => {
		expect(
			names(meta({ language: null, topics: ['telegram-bot', 'ai', 'rest-api', 'claude_code'] }), {})
		).toEqual(['Telegram Bot', 'AI', 'REST API', 'Claude Code']);
	});
});

describe('fetchRepoHeadSha', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns the commit sha for a ref', async () => {
		const fetchMock = mockFetch(200, { sha: 'd28ab862577afe9bf0d6e87ee4c4a591f2925420' });
		vi.stubGlobal('fetch', fetchMock);
		expect(await fetchRepoHeadSha(ref, 'main')).toBe('d28ab862577afe9bf0d6e87ee4c4a591f2925420');
		expect(fetchMock.mock.calls[0][0]).toContain('/commits/main');
	});

	it('refuses a response with no sha rather than importing under a blank key', async () => {
		vi.stubGlobal('fetch', mockFetch(200, {}));
		await expect(fetchRepoHeadSha(ref, 'main')).rejects.toMatchObject({ status: 502 });
	});
});

/** A Response whose body streams `chunks`, so the size guard can be exercised. */
function streamingResponse(chunks: Uint8Array[], headers: Record<string, string> = {}) {
	let i = 0;
	let cancelled = false;
	const reader = {
		read: async () => (i < chunks.length ? { done: false, value: chunks[i++] } : { done: true }),
		cancel: async () => {
			cancelled = true;
		}
	};
	return {
		response: {
			status: 200,
			ok: true,
			headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
			body: { getReader: () => reader }
		},
		wasCancelled: () => cancelled
	};
}

describe('fetchRepoArchive', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('concatenates the streamed chunks in order', async () => {
		const { response } = streamingResponse([new Uint8Array([1, 2]), new Uint8Array([3])]);
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
		expect(Array.from(await fetchRepoArchive(ref, 'main'))).toEqual([1, 2, 3]);
	});

	it('rejects on the advertised length before downloading anything', async () => {
		const { response } = streamingResponse([], {
			'content-length': String(MAX_ARCHIVE_BYTES + 1)
		});
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
		await expect(fetchRepoArchive(ref, 'main')).rejects.toMatchObject({ status: 413 });
	});

	it('aborts mid-stream when a chunked response exceeds the cap', async () => {
		// The guard cannot rest on content-length: codeload often omits it, and a
		// wrong header would otherwise be the whole protection.
		const chunk = new Uint8Array(1024 * 1024);
		const chunks = Array.from({ length: 200 }, () => chunk);
		const { response, wasCancelled } = streamingResponse(chunks);
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
		await expect(fetchRepoArchive(ref, 'main')).rejects.toMatchObject({ status: 413 });
		expect(wasCancelled()).toBe(true);
	});

	it('maps a missing repo the same way the metadata calls do', async () => {
		vi.stubGlobal('fetch', mockFetch(404, {}));
		await expect(fetchRepoArchive(ref, 'main')).rejects.toMatchObject({ status: 404 });
	});
});
