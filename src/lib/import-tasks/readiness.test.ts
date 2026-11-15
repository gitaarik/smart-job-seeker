import { describe, expect, it } from 'vitest';
import {
	computeImportTaskBlockers,
	isTaskBrowserProvider,
	type ImportTaskReadinessInput,
	isImportTaskRunnable,
	providerRequiresDevice
} from './readiness';

/** A fully-runnable public-platform task on a server-side browser. */
const ready: ImportTaskReadinessInput = {
	platformId: 1,
	platformName: 'SvelteJobs',
	taskSearchUrl: null,
	platformSearchPageUrl: 'https://sveltejobs.com/jobs',
	platformLoginPageUrl: null,
	browserProvider: 'local',
	serverBrowserProvider: 'local',
	deviceConnected: false
};

function keys(input: ImportTaskReadinessInput): string[] {
	return computeImportTaskBlockers(input).map((b) => b.key);
}

describe('providerRequiresDevice', () => {
	it('only the tunnel provider needs a user device', () => {
		expect(providerRequiresDevice('tunnel', 'local')).toBe(true);
		expect(providerRequiresDevice('local', 'local')).toBe(false);
	});

	it('falls back to the server default when the task has no provider', () => {
		expect(providerRequiresDevice(null, 'tunnel')).toBe(true);
		expect(providerRequiresDevice(null, 'local')).toBe(false);
	});
});

describe('isTaskBrowserProvider', () => {
	it('accepts the two providers a task may name', () => {
		for (const p of ['local', 'tunnel']) {
			expect(isTaskBrowserProvider(p), p).toBe(true);
		}
	});

	it('rejects the retired cloud providers', () => {
		expect(isTaskBrowserProvider('hosted')).toBe(false);
		expect(isTaskBrowserProvider('goLogin')).toBe(false);
	});

	it('rejects unknown strings and non-strings', () => {
		for (const p of ['', 'LOCAL', 'docker', null, undefined, 1, {}]) {
			expect(isTaskBrowserProvider(p), String(p)).toBe(false);
		}
	});
});

describe('computeImportTaskBlockers', () => {
	it('a fully-configured task has no blockers', () => {
		expect(computeImportTaskBlockers(ready)).toEqual([]);
		expect(isImportTaskRunnable(ready)).toBe(true);
	});

	it('flags a missing platform and stops there', () => {
		expect(keys({ ...ready, platformId: null })).toEqual(['platform']);
	});

	it('blocks every task on a paused platform, feeds included, and says which', () => {
		const paused = { ...ready, platformStatus: 'paused' };
		expect(keys(paused)).toEqual(['paused']);
		expect(keys({ ...paused, fetchMode: 'feed' })).toEqual(['paused']);
		expect(keys({ ...paused, platformSearchPageUrl: null, browserProvider: 'tunnel' })).toEqual([
			'paused'
		]);
		expect(computeImportTaskBlockers(paused)[0].detail).toContain('SvelteJobs is paused');
	});

	it('runs on a draft platform: user-added sites are drafts', () => {
		expect(keys({ ...ready, platformStatus: 'draft' })).toEqual([]);
	});

	it('flags a missing search URL when neither task nor platform has one', () => {
		expect(keys({ ...ready, platformSearchPageUrl: null })).toEqual(['search_url']);
		// A task-level search URL satisfies the requirement on its own.
		expect(
			keys({
				...ready,
				platformSearchPageUrl: null,
				taskSearchUrl: 'https://sveltejobs.com/jobs?q=svelte'
			})
		).toEqual([]);
	});

	it('accepts the platform base URL for a site with no search entry page', () => {
		// Curated-listing sites (SvelteJobs, X-Team) have no search form: their
		// landing page is the job list, so `url` is a legitimate starting point.
		// The worker and the run endpoint fall back the same way.
		expect(
			keys({
				...ready,
				platformSearchPageUrl: null,
				platformUrl: 'https://sveltejobs.com/'
			})
		).toEqual([]);
	});

	it('still flags a missing search URL when the platform has no URL either', () => {
		expect(keys({ ...ready, platformSearchPageUrl: null, platformUrl: null })).toEqual([
			'search_url'
		]);
	});

	it('requires a connected device only for the tunnel provider', () => {
		const tunnel = {
			...ready,
			browserProvider: 'tunnel',
			deviceConnected: false
		};
		expect(keys(tunnel)).toEqual(['device']);
		expect(keys({ ...tunnel, deviceConnected: true })).toEqual([]);
	});

	// The server holds no platform passwords (2026-11-14): the user signs in
	// once in the browser, and a lapsed session is a run-time stop, not a
	// reason to refuse the start.
	it('never blocks a gated platform on a saved login', () => {
		const gated = {
			...ready,
			platformLoginPageUrl: 'https://linkedin.com/login'
		};
		expect(keys(gated)).toEqual([]);
		expect(
			keys({
				...gated,
				browserProvider: 'tunnel',
				deviceConnected: false
			})
		).toEqual(['device']);
	});
});
