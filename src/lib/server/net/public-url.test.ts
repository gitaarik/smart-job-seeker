import { describe, expect, it } from 'vitest';
import { checkPublicHttpUrl, isPublicHttpUrl } from './public-url';

describe('checkPublicHttpUrl', () => {
	it('accepts ordinary public job-board URLs', () => {
		for (const u of [
			'https://www.linkedin.com/jobs/search/?keywords=svelte',
			'http://example.com/jobs',
			'https://jobs.acme.co.uk/list?page=2',
			'https://8.8.8.8/jobs'
		]) {
			expect(checkPublicHttpUrl(u).ok, u).toBe(true);
		}
	});

	it('rejects anything that is not http(s)', () => {
		for (const u of [
			'file:///etc/passwd',
			'gopher://x.com',
			'javascript:alert(1)',
			'ftp://a.com'
		]) {
			expect(isPublicHttpUrl(u), u).toBe(false);
		}
	});

	it('rejects loopback and container names', () => {
		for (const u of [
			'http://localhost:5432',
			'http://127.0.0.1/',
			'http://[::1]:6379/',
			'http://database:5432/',
			'http://redis/',
			'http://app:3000/api',
			'http://host.docker.internal:9222/json/version'
		]) {
			expect(isPublicHttpUrl(u), u).toBe(false);
		}
	});

	it('rejects the cloud metadata endpoint and other link-local addresses', () => {
		expect(isPublicHttpUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
		expect(isPublicHttpUrl('http://metadata.google.internal/computeMetadata/v1/')).toBe(false);
		expect(isPublicHttpUrl('http://[fe80::1]/')).toBe(false);
	});

	it('rejects RFC1918, CGNAT and unique-local ranges', () => {
		for (const u of [
			'http://10.0.0.5/',
			'http://192.168.1.1/',
			'http://172.16.0.1/',
			'http://172.31.255.254/',
			'http://100.64.0.1/',
			'http://[fc00::1]/',
			'http://[::ffff:10.0.0.1]/'
		]) {
			expect(isPublicHttpUrl(u), u).toBe(false);
		}
	});

	it('allows 172.32.x, which is outside the private block', () => {
		expect(isPublicHttpUrl('http://172.32.0.1/')).toBe(true);
	});

	it('rejects empty and unparseable input', () => {
		for (const u of [null, undefined, '', '   ', 'example.com/jobs', 'not a url']) {
			expect(isPublicHttpUrl(u as string | null | undefined), String(u)).toBe(false);
		}
	});

	it('returns the parsed URL so callers need not re-parse', () => {
		const res = checkPublicHttpUrl('  https://Example.com/Jobs?q=1  ');
		expect(res.ok).toBe(true);
		if (res.ok) expect(res.url.hostname).toBe('example.com');
	});
});
