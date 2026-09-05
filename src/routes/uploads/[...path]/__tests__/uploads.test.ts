/**
 * Tests for GET /uploads/[...path]
 *
 * Public media only. The two refusals are what matter: nothing outside the
 * uploads directory, and nothing from the private blob store under it.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ readFile: vi.fn() }));
vi.mock('fs/promises', () => ({ readFile: mocks.readFile }));

import { GET } from '../+server';

const get = (path: string) => GET({ params: { path } } as unknown as Parameters<typeof GET>[0]);

describe('GET /uploads/[...path]', () => {
	beforeEach(() => {
		mocks.readFile.mockReset();
	});

	it('serves a public media file with its content type', async () => {
		mocks.readFile.mockResolvedValueOnce(Buffer.from('png-bytes'));
		const res = await get('logos/acme.png');
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('image/png');
	});

	it('404s a file that is not there', async () => {
		mocks.readFile.mockRejectedValueOnce(Object.assign(new Error('nope'), { code: 'ENOENT' }));
		await expect(get('logos/missing.png')).rejects.toMatchObject({ status: 404 });
	});

	it('refuses the private blob store however the path spells it', async () => {
		for (const path of ['files/abc.pdf', 'logos/../files/abc.pdf', 'files']) {
			await expect(get(path), path).rejects.toMatchObject({ status: 403 });
		}
		expect(mocks.readFile).not.toHaveBeenCalled();
	});

	// A bare prefix test let `../uploads-anything/x` through: it resolves to a
	// sibling directory whose name starts with ours. The guard checks for the
	// separator now.
	it('refuses traversal out of the directory, including into a sibling with the same prefix', async () => {
		for (const path of [
			'../etc/passwd',
			'../uploads-private/secret.png',
			'a/../../uploads2/x.png'
		]) {
			await expect(get(path), path).rejects.toMatchObject({ status: 403 });
		}
		expect(mocks.readFile).not.toHaveBeenCalled();
	});
});
