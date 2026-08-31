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
	loginMode: 'none',
	hasCredential: false,
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
		expect(providerRequiresDevice('hosted', 'local')).toBe(false);
	});

	it('falls back to the server default when the task has no provider', () => {
		expect(providerRequiresDevice(null, 'tunnel')).toBe(true);
		expect(providerRequiresDevice(null, 'local')).toBe(false);
	});
});

describe('isTaskBrowserProvider', () => {
	it('accepts the three providers a task may name', () => {
		for (const p of ['local', 'hosted', 'tunnel']) {
			expect(isTaskBrowserProvider(p), p).toBe(true);
		}
	});

	it('rejects goLogin, which is a server-config value rather than a task one', () => {
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

	it('requires credentials for a gated platform on auto login', () => {
		const gated = {
			...ready,
			platformLoginPageUrl: 'https://linkedin.com/login',
			loginMode: 'auto',
			hasCredential: false
		};
		expect(keys(gated)).toEqual(['credentials']);
		expect(keys({ ...gated, hasCredential: true })).toEqual([]);
	});

	it('does not require credentials for manual or none login modes', () => {
		const gated = {
			...ready,
			platformLoginPageUrl: 'https://linkedin.com/login',
			hasCredential: false
		};
		expect(keys({ ...gated, loginMode: 'manual' })).toEqual([]);
		expect(keys({ ...gated, loginMode: 'none' })).toEqual([]);
	});

	it('reports device and credential blockers together', () => {
		expect(
			keys({
				...ready,
				browserProvider: 'tunnel',
				deviceConnected: false,
				platformLoginPageUrl: 'https://linkedin.com/login',
				loginMode: 'auto',
				hasCredential: false
			})
		).toEqual(['device', 'credentials']);
	});
});
