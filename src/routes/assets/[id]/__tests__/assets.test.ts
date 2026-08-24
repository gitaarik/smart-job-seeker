/**
 * `/assets/<id>` and the ids that are not ids.
 *
 * `files.id` is a `uuid` column, so a path segment that is not one reaches
 * Postgres as an invalid cast: a 500 with the failing query and its parameters
 * in the message, not the 404 the route means. Scanners probe this prefix
 * constantly — `/assets/.env`, `/assets/mail.json` — and every probe landed in
 * GlitchTip as an application error (9 issues, 84 events) that
 * `isFrameworkClientError` could not filter, because it matches SvelteKit's
 * own `Not found:` and this failed a step earlier than the router.
 *
 * So the assertion is not only "non-uuid gives 404" but that the query is
 * never issued at all: the shape check has to happen in front of the database,
 * or the noise comes back.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindFirst = vi.fn();
const mockReadFile = vi.fn();

vi.mock('$lib/server/db', () => ({
	dbDirect: { query: { files: { findFirst: (...a: unknown[]) => mockFindFirst(...a) } } }
}));
vi.mock('$lib/server/db/schema', () => ({ files: { id: 'files.id' } }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn((_c: unknown, v: unknown) => v) }));
vi.mock('fs/promises', () => ({ readFile: (...a: unknown[]) => mockReadFile(...a) }));

import { GET } from '../+server';

const UUID = '3f4a9c02-1b7e-4d51-9c8a-2e6f70b1d4aa';

function get(id: string) {
	return (GET as unknown as (e: { params: { id: string } }) => Promise<Response>)({
		params: { id }
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	mockFindFirst.mockResolvedValue({
		filename_disk: 'abc.png',
		type: 'image/png',
		filename_download: 'photo.png'
	});
	mockReadFile.mockResolvedValue(Buffer.from('bytes'));
});

describe('a path segment that is not a uuid', () => {
	// The literal probes from the GlitchTip issues.
	const probes = ['.env', 'mail.json', 'manifest.json', 'config.json', 'index.php'];

	it.each(probes)('404s /assets/%s', async (probe) => {
		await expect(get(probe)).rejects.toMatchObject({ status: 404 });
	});

	it('never reaches the database with one', async () => {
		for (const probe of [...probes, '', '123', 'null', 'undefined']) {
			await expect(get(probe)).rejects.toMatchObject({ status: 404 });
		}
		expect(mockFindFirst).not.toHaveBeenCalled();
	});

	it('404s a uuid-shaped string that is not one', async () => {
		// Right length and dashes, wrong alphabet; and a right-alphabet one a
		// group short.
		await expect(get('zzzzzzzz-1b7e-4d51-9c8a-2e6f70b1d4aa')).rejects.toMatchObject({
			status: 404
		});
		await expect(get('3f4a9c02-1b7e-4d51-9c8a-2e6f70b1d4a')).rejects.toMatchObject({ status: 404 });
		expect(mockFindFirst).not.toHaveBeenCalled();
	});
});

describe('a real id', () => {
	it('serves the file', async () => {
		const res = await get(UUID);
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('image/png');
		expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
		expect(mockFindFirst).toHaveBeenCalledTimes(1);
	});

	it('accepts the uppercase form Postgres would', async () => {
		const res = await get(UUID.toUpperCase());
		expect(res.status).toBe(200);
	});

	it('falls back to a generic content type when the row has none', async () => {
		mockFindFirst.mockResolvedValue({ filename_disk: 'abc.bin', type: null });
		const res = await get(UUID);
		expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
	});

	it('404s when no row holds it', async () => {
		mockFindFirst.mockResolvedValue(undefined);
		await expect(get(UUID)).rejects.toMatchObject({ status: 404 });
	});

	// A row whose bytes were never stored, or were reaped from under it.
	it('404s when the row names no blob', async () => {
		mockFindFirst.mockResolvedValue({ filename_disk: null, type: 'image/png' });
		await expect(get(UUID)).rejects.toMatchObject({ status: 404 });
		expect(mockReadFile).not.toHaveBeenCalled();
	});

	it('404s when the blob is gone from disk', async () => {
		mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
		await expect(get(UUID)).rejects.toMatchObject({ status: 404 });
	});
});
