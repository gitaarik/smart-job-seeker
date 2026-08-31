/**
 * `/assets/<id>`: what it serves, and the two things it must not.
 *
 * **Not private files.** `files` is one table shared by profile pictures and
 * logos, which belong on a public page, and by CVs, profile exports,
 * application attachments and project images, which do not. This route has no
 * caller to ask about, so it answers only for a file something public points
 * at. That is the assertion that matters most here: a row that exists and is
 * not reachable as a public asset must 404 without its bytes being read.
 *
 * **Not 500s for scanners.** `files.id` is a `uuid` column, so a path segment
 * that is not one reaches Postgres as an invalid cast: a 500 with the failing
 * query and its parameters in the message, not the 404 the route means.
 * Scanners probe this prefix constantly — `/assets/.env`, `/assets/mail.json`
 * — and every probe landed in GlitchTip as an application error (9 issues, 84
 * events) that `isFrameworkClientError` could not filter, because it matches
 * SvelteKit's own `Not found:` and this failed a step earlier than the router.
 *
 * So the assertion is not only "non-uuid gives 404" but that the query is
 * never issued at all: the shape check has to happen in front of the database,
 * or the noise comes back.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const mockReadFile = vi.fn();

vi.mock('$lib/server/db', () => ({
	queryRawDirect: (...a: unknown[]) => mockQuery(...a)
}));
vi.mock('drizzle-orm', () => ({
	sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })
}));
vi.mock('fs/promises', () => ({ readFile: (...a: unknown[]) => mockReadFile(...a) }));

import { GET } from '../+server';

const UUID = '3f4a9c02-1b7e-4d51-9c8a-2e6f70b1d4aa';

function get(id: string) {
	return (GET as unknown as (e: { params: { id: string } }) => Promise<Response>)({
		params: { id }
	});
}

/** One row, as the single lookup-and-public-test statement returns it. */
function row(
	over: Partial<{ filename_disk: string | null; type: string | null; is_public: boolean }> = {}
) {
	return [{ filename_disk: 'abc.png', type: 'image/png', is_public: true, ...over }];
}

beforeEach(() => {
	vi.clearAllMocks();
	mockQuery.mockResolvedValue(row());
	mockReadFile.mockResolvedValue(Buffer.from('bytes'));
	vi.spyOn(console, 'warn').mockImplementation(() => {});
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
		expect(mockQuery).not.toHaveBeenCalled();
	});

	it('404s a uuid-shaped string that is not one', async () => {
		// Right length and dashes, wrong alphabet; and a right-alphabet one a
		// group short.
		await expect(get('zzzzzzzz-1b7e-4d51-9c8a-2e6f70b1d4aa')).rejects.toMatchObject({
			status: 404
		});
		await expect(get('3f4a9c02-1b7e-4d51-9c8a-2e6f70b1d4a')).rejects.toMatchObject({ status: 404 });
		expect(mockQuery).not.toHaveBeenCalled();
	});
});

describe('a public asset', () => {
	it('serves the file', async () => {
		const res = await get(UUID);
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('image/png');
		expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
		// Served as what it claims to be: sniffing is how a stored blob on the app
		// origin becomes a document the browser will execute.
		expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(mockQuery).toHaveBeenCalledTimes(1);
	});

	it('accepts the uppercase form Postgres would', async () => {
		const res = await get(UUID.toUpperCase());
		expect(res.status).toBe(200);
	});

	it('falls back to a generic content type when the row has none', async () => {
		mockQuery.mockResolvedValue(row({ filename_disk: 'abc.bin', type: null }));
		const res = await get(UUID);
		expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
	});

	it('404s when no row holds it', async () => {
		mockQuery.mockResolvedValue([]);
		await expect(get(UUID)).rejects.toMatchObject({ status: 404 });
	});

	// A row whose bytes were never stored, or were reaped from under it.
	it('404s when the row names no blob', async () => {
		mockQuery.mockResolvedValue(row({ filename_disk: null }));
		await expect(get(UUID)).rejects.toMatchObject({ status: 404 });
		expect(mockReadFile).not.toHaveBeenCalled();
	});

	it('404s when the blob is gone from disk', async () => {
		mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
		await expect(get(UUID)).rejects.toMatchObject({ status: 404 });
	});
});

/**
 * A CV, a profile export, an application attachment, a project image: a real
 * row, with real bytes, that nothing public points at. The 404 rather than a
 * 403 is deliberate — to a caller this route cannot identify, "no such asset"
 * is the true answer, and a 403 would confirm the id names something real.
 */
describe('a file nothing public points at', () => {
	beforeEach(() => {
		mockQuery.mockResolvedValue(row({ is_public: false }));
	});

	it('404s instead of serving it', async () => {
		await expect(get(UUID)).rejects.toMatchObject({ status: 404 });
	});

	it('never reads the blob', async () => {
		await expect(get(UUID)).rejects.toMatchObject({ status: 404 });
		expect(mockReadFile).not.toHaveBeenCalled();
	});

	// The same refusal covers a public kind nobody added to the allowlist, which
	// looks like an image that silently stopped loading. Say so in the log.
	it('leaves a breadcrumb, since the other cause is a missing allowlist entry', async () => {
		await expect(get(UUID)).rejects.toMatchObject({ status: 404 });
		expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(UUID));
	});
});
