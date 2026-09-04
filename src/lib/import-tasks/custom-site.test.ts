import { describe, expect, it } from 'vitest';
import {
	SEARCH_PAGE_URL_MAX,
	resolveCustomSiteSearchUrl,
	type CustomSiteSearchInput
} from './custom-site';

/** The common case: a brand-new site, its pasted URL now its search page. */
const newSite: CustomSiteSearchInput = {
	platformIsNew: true,
	pastedUrl: 'https://acme.example.com/jobs',
	platformSearchPageUrl: 'https://acme.example.com/jobs',
	platformName: 'acme.example.com',
	searchTerm: null
};

function resolve(overrides: Partial<CustomSiteSearchInput> = {}) {
	return resolveCustomSiteSearchUrl({ ...newSite, ...overrides });
}

describe('resolveCustomSiteSearchUrl', () => {
	it('drops the task URL once it is the platform search page', () => {
		// Null is the whole point: with a search_url set, configureSearchViaForm
		// skips the form, so the keyword would never be typed.
		expect(resolve()).toEqual({ ok: true, searchUrl: null });
		expect(resolve({ searchTerm: 'python developer' })).toEqual({ ok: true, searchUrl: null });
	});

	it('keeps the URL when it did not become the search page and no keywords were given', () => {
		expect(
			resolve({ platformSearchPageUrl: 'https://acme.example.com/search', searchTerm: null })
		).toEqual({ ok: true, searchUrl: 'https://acme.example.com/jobs' });
	});

	it('keeps the URL for a site with no search page at all', () => {
		expect(resolve({ platformSearchPageUrl: null })).toEqual({
			ok: true,
			searchUrl: 'https://acme.example.com/jobs'
		});
	});

	it('refuses keywords that would be silently dropped, naming the site', () => {
		const result = resolve({
			platformSearchPageUrl: 'https://www.linkedin.com/jobs/search/',
			platformName: 'LinkedIn',
			searchTerm: 'python developer'
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain('LinkedIn');
	});

	it('explains an over-long URL as a length problem, not a known-site one', () => {
		// Too long for varchar(512), so it never became the search page. Telling
		// this user to "pick it from the Site list" would be nonsense advice.
		const long = `https://acme.example.com/jobs?q=${'x'.repeat(SEARCH_PAGE_URL_MAX)}`;
		const result = resolve({
			pastedUrl: long,
			platformSearchPageUrl: null,
			searchTerm: 'python developer'
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain('too long');
		expect(result.error).not.toContain('Site list');
	});

	it('leaves a dropdown platform alone', () => {
		expect(
			resolveCustomSiteSearchUrl({
				platformIsNew: false,
				pastedUrl: null,
				platformSearchPageUrl: 'https://www.linkedin.com/jobs/search/',
				platformName: 'LinkedIn',
				searchTerm: 'python developer'
			})
		).toEqual({ ok: true, searchUrl: null });
	});

	it('passes through a hand-built URL on a platform picked from the dropdown', () => {
		// The edit flow sends both; a task URL beating the platform search page
		// is deliberate there (the LinkedIn "recommended" collection).
		expect(
			resolveCustomSiteSearchUrl({
				platformIsNew: false,
				pastedUrl: 'https://www.linkedin.com/jobs/collections/recommended/',
				platformSearchPageUrl: 'https://www.linkedin.com/jobs/search/',
				platformName: 'LinkedIn',
				searchTerm: null
			})
		).toEqual({ ok: true, searchUrl: 'https://www.linkedin.com/jobs/collections/recommended/' });
	});
});
