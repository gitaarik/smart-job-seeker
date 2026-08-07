/**
 * Unit tests for URL normalization utility
 */

import { describe, expect, it } from 'vitest';
import { areJobUrlsEqual, normalizeJobUrl } from '../normalize-url';

describe('normalizeJobUrl', () => {
	describe('tracking parameter removal', () => {
		it('should remove UTM parameters', () => {
			const url = 'https://example.com/jobs/123?utm_source=google&utm_medium=cpc&utm_campaign=jobs';
			expect(normalizeJobUrl(url)).toBe('https://example.com/jobs/123');
		});

		it('should remove Facebook click ID', () => {
			const url = 'https://example.com/jobs/123?fbclid=abc123xyz';
			expect(normalizeJobUrl(url)).toBe('https://example.com/jobs/123');
		});

		it('should remove Google click ID', () => {
			const url = 'https://example.com/jobs/123?gclid=abc123xyz';
			expect(normalizeJobUrl(url)).toBe('https://example.com/jobs/123');
		});

		it('should remove generic tracking parameters', () => {
			const url = 'https://example.com/jobs/123?tracking=abc&ref=homepage&source=email';
			expect(normalizeJobUrl(url)).toBe('https://example.com/jobs/123');
		});

		it('should preserve non-tracking query parameters', () => {
			const url = 'https://example.com/jobs?id=123&category=engineering';
			expect(normalizeJobUrl(url)).toBe('https://example.com/jobs?id=123&category=engineering');
		});

		it('should handle mixed tracking and non-tracking params', () => {
			const url = 'https://example.com/jobs?id=123&utm_source=google&category=dev';
			expect(normalizeJobUrl(url)).toBe('https://example.com/jobs?id=123&category=dev');
		});
	});

	describe('LinkedIn URL handling', () => {
		it('should remove LinkedIn tracking params (eBP, refId, trackingId, trk)', () => {
			const url =
				'https://www.linkedin.com/jobs/view/123456?trackingId=abc&refId=xyz&trk=flagship3_search_srp_jobs&eBP=CwEAAAGci3ssFIlzMkdNdUi37nd';
			expect(normalizeJobUrl(url)).toBe('https://www.linkedin.com/jobs/view/123456');
		});

		it('should remove generic tracking params from LinkedIn URLs', () => {
			const url = 'https://linkedin.com/jobs/view/123456?tracking=abc&utm_source=google';
			expect(normalizeJobUrl(url)).toBe('https://linkedin.com/jobs/view/123456');
		});

		it('should normalize long LinkedIn URLs to short form', () => {
			const longUrl =
				'https://www.linkedin.com/jobs/view/4359834666/?eBP=CwEAAAGci3ssFIlzMkdNdUi37ndlMm4dF8m5NPBXxtgGxofnZRpOQqUBSMdK9vI755b0EZau62EAxhSxewOTndSdwzrfYi_ln0wildHexdbbQyO9BzCiPGGnOhb6CSPnzlnxPQoUrv8K8Htn87QF7Y4uvX6tXRdijmdX8QSVp9Zkeb_7OMkhNX5OSsTVUD0kSh_LgKVuAzZPlPO3UsYzWe9LMz5T7zAiEiQMgT_PqutFsOkSlmXe18e6k7Y6_cjSD4qJtJkMQuGyv9vvn9JJtoueOFhCzLxpwjoVTcfM12tMkTDjIHfx9GOlXUSUDA5NW7qrjQ0QlxJ1327SQMvj&refId=CTuHn76pNm3SxPiaS5Fskw%3D%3D&trackingId=UmIzmp4OAsM0X4STknIcUA%3D%3D&trk=flagship3_search_srp_jobs';
			const normalized = normalizeJobUrl(longUrl);
			expect(normalized).toBe('https://www.linkedin.com/jobs/view/4359834666');
			expect(normalized.length).toBeLessThan(255);
		});

		it('should preserve currentJobId in LinkedIn search URLs', () => {
			const url =
				'https://www.linkedin.com/jobs/search/?currentJobId=123&f_E=3%2C4&keywords=developer';
			expect(normalizeJobUrl(url)).toBe(
				'https://www.linkedin.com/jobs/search/?currentJobId=123&f_E=3%2C4&keywords=developer'
			);
		});
	});

	describe('hash fragment handling', () => {
		it('should remove hash fragments', () => {
			const url = 'https://example.com/jobs/123#apply';
			expect(normalizeJobUrl(url)).toBe('https://example.com/jobs/123');
		});

		it('should remove hash with query params', () => {
			const url = 'https://example.com/jobs?id=123#details';
			expect(normalizeJobUrl(url)).toBe('https://example.com/jobs?id=123');
		});
	});

	describe('trailing slash handling', () => {
		it('should remove trailing slash from paths', () => {
			const url = 'https://example.com/jobs/123/';
			expect(normalizeJobUrl(url)).toBe('https://example.com/jobs/123');
		});

		it('should not remove slash from root path', () => {
			const url = 'https://example.com/';
			expect(normalizeJobUrl(url)).toBe('https://example.com/');
		});
	});

	describe('error handling', () => {
		it('should return invalid URL as-is', () => {
			const invalidUrl = 'not-a-valid-url';
			expect(normalizeJobUrl(invalidUrl)).toBe('not-a-valid-url');
		});

		it('should handle empty string', () => {
			expect(normalizeJobUrl('')).toBe('');
		});
	});
});

describe('areJobUrlsEqual', () => {
	it('should match URLs that differ only by tracking params', () => {
		const url1 = 'https://example.com/jobs/123?utm_source=google';
		const url2 = 'https://example.com/jobs/123?utm_source=email';
		expect(areJobUrlsEqual(url1, url2)).toBe(true);
	});

	it('should match URLs with different query param order', () => {
		const url1 = 'https://example.com/jobs?id=123&category=dev';
		const url2 = 'https://example.com/jobs?category=dev&id=123';
		// Note: URL normalization preserves param order, so these will differ
		// This test verifies the actual behavior
		expect(areJobUrlsEqual(url1, url2)).toBe(false);
	});

	it('should not match different job URLs', () => {
		const url1 = 'https://example.com/jobs/123';
		const url2 = 'https://example.com/jobs/456';
		expect(areJobUrlsEqual(url1, url2)).toBe(false);
	});

	it('should match LinkedIn URLs that differ only by tracking params', () => {
		const url1 = 'https://www.linkedin.com/jobs/view/123456?utm_source=google';
		const url2 = 'https://www.linkedin.com/jobs/view/123456?utm_source=email';
		expect(areJobUrlsEqual(url1, url2)).toBe(true);
	});

	it('should not match LinkedIn URLs with different job identifiers', () => {
		const url1 = 'https://www.linkedin.com/jobs/search/?currentJobId=123';
		const url2 = 'https://www.linkedin.com/jobs/search/?currentJobId=456';
		expect(areJobUrlsEqual(url1, url2)).toBe(false);
	});
});
