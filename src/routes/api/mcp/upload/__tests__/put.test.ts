/**
 * PUT /api/mcp/upload: the link is the whole credential.
 *
 * No authorization header is read, so what stands between a request and a
 * write is the signed grant and the key it names, looked up again now. These
 * cases are the ways that key can have stopped being good since the link was
 * minted, plus the header an older client may still send.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signUploadGrant } from '$lib/server/mcp/upload-grants';

const verifyMcpKeyById = vi.fn();
const attachFileToRecord = vi.fn();

vi.mock('$lib/server/mcp/keys', () => ({
	verifyMcpKeyById: (...a: unknown[]) => verifyMcpKeyById(...a)
}));

vi.mock('$lib/server/applications/record-files', () => ({
	attachFileToRecord: (...a: unknown[]) => attachFileToRecord(...a)
}));

vi.mock('$lib/server/middleware/rate-limit', () => ({
	mcpRateLimiter: { tryConsumeKey: () => true, retryAfterSeconds: () => 1 },
	createRateLimitResponse: vi.fn()
}));

const { PUT } = await import('../+server');

const GRANT = { keyId: 9, profileId: 1, applicationId: 77, recordId: 199 };
const LIVE_KEY = {
	keyId: 9,
	userId: 3,
	profileId: 1,
	scope: 'write',
	readScope: 'record',
	name: 'Claude Code'
};

function put(grant: string | null, headers: Record<string, string> = {}) {
	const url = new URL('http://localhost/api/mcp/upload');
	if (grant !== null) url.searchParams.set('grant', grant);
	const request = new Request(url, { method: 'PUT', headers, body: 'Subject: hi\n\nbody' });
	return PUT({ request, url } as unknown as Parameters<typeof PUT>[0]);
}

beforeEach(() => {
	verifyMcpKeyById.mockReset().mockResolvedValue(LIVE_KEY);
	attachFileToRecord.mockReset().mockResolvedValue({ fileId: 'f1', extracted: true });
});

describe('PUT /api/mcp/upload', () => {
	it('attaches with the link alone, where the grant says', async () => {
		const res = await put(signUploadGrant(GRANT, 'invite.eml'));

		expect(res.status).toBe(200);
		expect(verifyMcpKeyById).toHaveBeenCalledWith(9);
		expect(attachFileToRecord).toHaveBeenCalledWith(
			expect.objectContaining({
				recordId: 199,
				applicationId: 77,
				profileId: 1,
				filename: 'invite.eml'
			})
		);
	});

	it('does not read an authorization header, even one holding a dead key', async () => {
		// What the agent that prompted this change sent: a stale key, and a 401.
		const res = await put(signUploadGrant(GRANT, 'invite.eml'), {
			authorization: 'Bearer sjsmcp_long_since_revoked'
		});

		expect(res.status).toBe(200);
	});

	it('refuses once the key it was issued to stops verifying', async () => {
		// Revoked, expired, or its profile gone: the lookup is null for all three.
		verifyMcpKeyById.mockResolvedValue(null);

		expect((await put(signUploadGrant(GRANT, 'invite.eml'))).status).toBe(403);
		expect(attachFileToRecord).not.toHaveBeenCalled();
	});

	it('refuses when the key now belongs to another profile', async () => {
		verifyMcpKeyById.mockResolvedValue({ ...LIVE_KEY, profileId: 2 });

		expect((await put(signUploadGrant(GRANT, 'invite.eml'))).status).toBe(403);
		expect(attachFileToRecord).not.toHaveBeenCalled();
	});

	it('refuses when the key has been narrowed to read', async () => {
		verifyMcpKeyById.mockResolvedValue({ ...LIVE_KEY, scope: 'read' });

		expect((await put(signUploadGrant(GRANT, 'invite.eml'))).status).toBe(403);
		expect(attachFileToRecord).not.toHaveBeenCalled();
	});

	it('refuses a missing or forged grant before looking up any key', async () => {
		expect((await put(null)).status).toBe(400);

		// Repointed at another profile, keeping the original signature.
		const [, signature] = signUploadGrant(GRANT, 'invite.eml').split('.');
		const payload = `${Date.now()}:9:2:77:199:invite.eml`;
		const forged = `${Buffer.from(payload).toString('base64url')}.${signature}`;

		expect((await put(forged)).status).toBe(403);
		expect(verifyMcpKeyById).not.toHaveBeenCalled();
		expect(attachFileToRecord).not.toHaveBeenCalled();
	});
});
