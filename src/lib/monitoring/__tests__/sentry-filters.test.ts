import { describe, expect, it } from 'vitest';
import { isFrameworkClientError } from '../sentry-filters';

describe('isFrameworkClientError', () => {
	it('drops Not found errors from scanner probes', () => {
		expect(isFrameworkClientError('Not found: /.env')).toBe(true);
		expect(isFrameworkClientError('Not found: /wp-admin/install.php')).toBe(true);
		expect(isFrameworkClientError('Not found: /.git/config')).toBe(true);
	});

	it('drops method-not-allowed bot probes', () => {
		expect(
			isFrameworkClientError(
				'POST method not allowed. No form actions exist for the page at /(auth)'
			)
		).toBe(true);
	});

	it('keeps real application errors', () => {
		expect(isFrameworkClientError('cannot cast type record to integer[]')).toBe(false);
		expect(isFrameworkClientError('Failed query: SELECT ...')).toBe(false);
		expect(isFrameworkClientError('TypeError: x is undefined')).toBe(false);
	});

	it('handles missing message', () => {
		expect(isFrameworkClientError(undefined)).toBe(false);
		expect(isFrameworkClientError('')).toBe(false);
	});

	it('only matches at the start (not substrings)', () => {
		expect(isFrameworkClientError('Some context: Not found: /x')).toBe(false);
	});
});
