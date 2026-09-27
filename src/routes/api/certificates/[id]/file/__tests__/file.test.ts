/**
 * `GET /api/certificates/[id]/file`: the only door to a certificate's document,
 * so what it checks before reading the bytes and the headers it serves them
 * with are the whole contract.
 *
 * - Ownership is settled before anything is read, and the row is then looked up
 *   by certificate id within the caller's own profile.
 * - Only a raster image renders in place. A PDF, or anything else, downloads,
 *   whatever `inline` asks for.
 * - Nothing is cached. The URL names the certificate, not the file, so a cached
 *   copy would outlive a Replace or a Remove.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findFirst = vi.fn();
const getFile = vi.fn();
const requireRowActor = vi.fn();

vi.mock('$lib/server/db', () => ({
	dbDirect: { query: { certificates: { findFirst: (...a: unknown[]) => findFirst(...a) } } }
}));
vi.mock('$lib/server/db/schema', () => ({
	certificates: { id: 'certificates.id', profile_id: 'certificates.profile_id' }
}));
vi.mock('drizzle-orm', () => ({
	and: (...conditions: unknown[]) => ({ and: conditions }),
	eq: (column: unknown, value: unknown) => ({ eq: [column, value] })
}));
vi.mock('$lib/server/files', () => ({
	getFile: (...a: unknown[]) => getFile(...a),
	contentDisposition: (name: string, inline: boolean) =>
		`${inline ? 'inline' : 'attachment'}; filename="${name}"`
}));
vi.mock('$lib/server/utils/api-helpers', async () => {
	const { error } = await import('@sveltejs/kit');
	return {
		requireAuth: (locals: { user: { id: string } | null }) => {
			if (!locals.user) error(401, 'Not authenticated');
			return locals.user;
		},
		parseIntParam: (value: string) => Number(value)
	};
});
vi.mock('$lib/server/profile/write-http', () => ({
	requireRowActor: (...a: unknown[]) => requireRowActor(...a)
}));
// The upload half, not under test here; the real module pulls in sharp.
vi.mock('$lib/server/profile/certificate-file', () => ({
	attachCertificateFile: vi.fn(),
	detachCertificateFile: vi.fn(),
	prepareCertificateFile: vi.fn(),
	CertificateFileError: class extends Error {}
}));

import { error } from '@sveltejs/kit';
import { GET } from '../+server';

function get(query = '', user: { id: string } | null = { id: 'user-1' }) {
	return (GET as unknown as (event: unknown) => Promise<Response>)({
		params: { id: '7' },
		url: new URL(`http://app/api/certificates/7/file${query}`),
		locals: { user }
	});
}

function stored(type: string | null, filename_download = 'certificate.pdf') {
	return { file_id: 'file-uuid', file: { filename_download, type } };
}

beforeEach(() => {
	vi.clearAllMocks();
	requireRowActor.mockResolvedValue({ profileId: 12 });
	findFirst.mockResolvedValue(stored('application/pdf'));
	getFile.mockResolvedValue(Buffer.from('%PDF-1.7'));
});

describe('who can read it', () => {
	it('refuses a visitor who is not signed in, before any lookup', async () => {
		await expect(get('', null)).rejects.toMatchObject({ status: 401 });
		expect(requireRowActor).not.toHaveBeenCalled();
		expect(getFile).not.toHaveBeenCalled();
	});

	it("reads nothing when the certificate is not the caller's", async () => {
		requireRowActor.mockImplementation(async () => error(403, 'Forbidden'));
		await expect(get()).rejects.toMatchObject({ status: 403 });
		expect(findFirst).not.toHaveBeenCalled();
		expect(getFile).not.toHaveBeenCalled();
	});

	it("looks the row up by certificate id within the caller's profile", async () => {
		await get();
		expect(requireRowActor).toHaveBeenCalledWith('certificate', 7, 'user-1');
		expect(findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					and: [{ eq: ['certificates.id', 7] }, { eq: ['certificates.profile_id', 12] }]
				}
			})
		);
		expect(getFile).toHaveBeenCalledWith('file-uuid');
	});

	it('404s a certificate with no file', async () => {
		findFirst.mockResolvedValue({ file_id: null, file: null });
		await expect(get()).rejects.toMatchObject({ status: 404 });
		expect(getFile).not.toHaveBeenCalled();
	});

	it('404s a file whose bytes are gone', async () => {
		getFile.mockRejectedValue(new Error('ENOENT'));
		await expect(get()).rejects.toMatchObject({ status: 404 });
	});
});

describe('how it is served', () => {
	it('serves the stored bytes as their stored type', async () => {
		const res = await get();
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('application/pdf');
		expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('%PDF-1.7');
	});

	it('downloads a PDF, even when asked to open it in place', async () => {
		for (const query of ['', '?inline=1']) {
			const res = await get(query);
			expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="certificate.pdf"');
		}
	});

	it('opens an image in place only when asked', async () => {
		findFirst.mockResolvedValue(stored('image/webp', 'certificate.webp'));
		expect((await get('?inline=1')).headers.get('Content-Disposition')).toMatch(/^inline;/);
		expect((await get()).headers.get('Content-Disposition')).toMatch(/^attachment;/);
	});

	it('never renders an SVG in place', async () => {
		// An image type that is a document: it can carry script.
		findFirst.mockResolvedValue(stored('image/svg+xml', 'certificate.svg'));
		expect((await get('?inline=1')).headers.get('Content-Disposition')).toMatch(/^attachment;/);
	});

	it('is never cached and never sniffed', async () => {
		const res = await get();
		expect(res.headers.get('Cache-Control')).toBe('private, no-store');
		expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
	});
});
