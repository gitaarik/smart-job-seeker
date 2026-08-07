/**
 * Tests for Platform Credentials API
 * PUT /api/platforms/[id]/credentials
 * DELETE /api/platforms/[id]/credentials
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockProfilesFindFirst = vi.fn();
const mockPlatformsFindFirst = vi.fn();
const mockPlatformCredentialsFindFirst = vi.fn();
const mockPlatformCredentialsFindMany = vi.fn();
const mockPlatformProfilesFindMany = vi.fn();

// Mock Drizzle update chain
const mockUpdateWhere = vi.fn().mockResolvedValue({});
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdateFn = vi.fn().mockReturnValue({ set: mockUpdateSet });

// Mock Drizzle insert chain — new credentials are returned via `.returning()`.
const mockInsertReturning = vi.fn().mockResolvedValue([{ id: 99 }]);
const mockInsertValues = vi.fn().mockReturnValue({
	returning: mockInsertReturning
});
const mockInsertFn = vi.fn().mockReturnValue({ values: mockInsertValues });

// Mock Drizzle delete chain
const mockDeleteWhere = vi.fn().mockResolvedValue({});
const mockDeleteFn = vi.fn().mockReturnValue({ where: mockDeleteWhere });

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		query: {
			profiles: { findFirst: (...a: any[]) => mockProfilesFindFirst(...a) },
			job_platforms: {
				findFirst: (...a: any[]) => mockPlatformsFindFirst(...a)
			},
			platform_credentials: {
				findFirst: (...a: any[]) => mockPlatformCredentialsFindFirst(...a),
				findMany: (...a: any[]) => mockPlatformCredentialsFindMany(...a)
			},
			platform_profiles: {
				findMany: (...a: any[]) => mockPlatformProfilesFindMany(...a)
			}
		},
		update: (...a: any[]) => mockUpdateFn(...a),
		insert: (...a: any[]) => mockInsertFn(...a),
		delete: (...a: any[]) => mockDeleteFn(...a)
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((_col: any, val: any) => val),
	and: vi.fn((...args: any[]) => args),
	inArray: vi.fn((_col: any, vals: any[]) => vals)
}));

vi.mock('$lib/server/db/schema', () => ({
	profiles: { id: 'profiles.id', user_id: 'profiles.user_id' },
	job_platforms: { id: 'job_platforms.id', status: 'job_platforms.status' },
	platform_credentials: {
		id: 'platform_credentials.id',
		user_id: 'platform_credentials.user_id',
		platform_id: 'platform_credentials.platform_id'
	},
	platform_profiles: {
		id: 'platform_profiles.id',
		platform_credential_id: 'platform_profiles.platform_credential_id'
	},
	search_tasks: {
		platform_profile_id: 'search_tasks.platform_profile_id',
		profile_id: 'search_tasks.profile_id'
	}
}));

vi.mock('$lib/server/auth/crypto', () => ({
	encryptCredential: (v: any) => v,
	decryptCredential: (v: any) => v
}));

import { DELETE, PUT } from '../+server';

function createPutEvent(body: any, user?: any) {
	return {
		params: { id: '5' },
		locals: {
			user: user === undefined ? { id: 'user-1' } : user,
			session: null
		},
		request: new Request('http://localhost/api/platforms/5/credentials', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as any;
}

function createDeleteEvent(params: Record<string, string>, user?: any) {
	const url = new URL('http://localhost/api/platforms/5/credentials');
	for (const [k, v] of Object.entries(params)) {
		url.searchParams.set(k, v);
	}
	return {
		params: { id: '5' },
		locals: {
			user: user === undefined ? { id: 'user-1' } : user,
			session: null
		},
		url
	} as any;
}

describe('PUT /api/platforms/[id]/credentials', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockProfilesFindFirst.mockReset();
		mockPlatformsFindFirst.mockReset();
		mockPlatformCredentialsFindFirst.mockReset();
		mockPlatformCredentialsFindMany.mockReset();
		mockPlatformProfilesFindMany.mockReset();
		mockUpdateWhere.mockResolvedValue({});
		mockInsertReturning.mockResolvedValue([{ id: 99 }]);
	});

	it('rejects unauthenticated', async () => {
		await expect(PUT(createPutEvent({ profileId: 1 }, null))).rejects.toMatchObject({
			status: 401
		});
	});

	it('rejects missing profileId', async () => {
		await expect(PUT(createPutEvent({ username: 'test' }))).rejects.toMatchObject({ status: 400 });
	});

	it("rejects when user doesn't own profile", async () => {
		mockProfilesFindFirst.mockResolvedValueOnce(null);
		await expect(PUT(createPutEvent({ profileId: 1 }))).rejects.toMatchObject({
			status: 403
		});
	});

	it("rejects when platform doesn't exist", async () => {
		mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
		mockPlatformsFindFirst.mockResolvedValueOnce(null);
		await expect(PUT(createPutEvent({ profileId: 1 }))).rejects.toMatchObject({
			status: 404
		});
	});

	it('creates new credentials when none exist', async () => {
		mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
		mockPlatformsFindFirst.mockResolvedValueOnce({ id: 5 });
		mockPlatformCredentialsFindFirst.mockResolvedValueOnce(null);

		const response = await PUT(
			createPutEvent({
				profileId: 1,
				username: 'user@test.com',
				password: 'pass123'
			})
		);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(mockInsertFn).toHaveBeenCalled();
		expect(mockInsertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				user_id: 'user-1',
				platform_id: 5,
				username: 'user@test.com',
				password: 'pass123'
			})
		);
	});

	it('updates existing credentials when credentialId given', async () => {
		mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
		mockPlatformsFindFirst.mockResolvedValueOnce({ id: 5 });
		mockPlatformCredentialsFindFirst.mockResolvedValueOnce({ id: 10 });

		const response = await PUT(
			createPutEvent({
				profileId: 1,
				credentialId: 10,
				username: 'new@test.com',
				password: 'newpass'
			})
		);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(mockUpdateFn).toHaveBeenCalled();
		// Credential update sets fields and bumps date_updated; the stale
		// login_error is cleared via a separate platform_profiles update.
		expect(mockUpdateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				username: 'new@test.com',
				password: 'newpass'
			})
		);
		expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ login_error: null }));
	});

	it('returns 404 when updating an unknown credentialId', async () => {
		mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
		mockPlatformsFindFirst.mockResolvedValueOnce({ id: 5 });
		mockPlatformCredentialsFindFirst.mockResolvedValueOnce(null);

		await expect(
			PUT(
				createPutEvent({
					profileId: 1,
					credentialId: 999,
					password: 'x'
				})
			)
		).rejects.toMatchObject({ status: 404 });
	});
});

describe('DELETE /api/platforms/[id]/credentials', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockProfilesFindFirst.mockReset();
		mockPlatformsFindFirst.mockReset();
		mockPlatformCredentialsFindFirst.mockReset();
		mockPlatformCredentialsFindMany.mockReset();
		mockPlatformProfilesFindMany.mockReset();
		mockDeleteWhere.mockResolvedValue({});
		mockUpdateWhere.mockResolvedValue({});
	});

	it('rejects unauthenticated', async () => {
		await expect(DELETE(createDeleteEvent({ profileId: '1' }, null))).rejects.toMatchObject({
			status: 401
		});
	});

	it('rejects missing profileId', async () => {
		await expect(DELETE(createDeleteEvent({}))).rejects.toMatchObject({ status: 400 });
	});

	it("rejects when user doesn't own profile", async () => {
		mockProfilesFindFirst.mockResolvedValueOnce(null);
		await expect(DELETE(createDeleteEvent({ profileId: '1' }))).rejects.toMatchObject({
			status: 403
		});
	});

	it('deletes specific credential and clears job search references', async () => {
		mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
		mockPlatformCredentialsFindFirst.mockResolvedValueOnce({ id: 10 });
		mockPlatformProfilesFindMany.mockResolvedValueOnce([{ id: 100 }]);

		const response = await DELETE(
			createDeleteEvent({
				profileId: '1',
				credentialId: '10'
			})
		);
		const data = await response.json();
		expect(data.success).toBe(true);
		// search_tasks reset to null for any platform_profiles that referenced
		// the deleted credential, then the credential itself deleted.
		expect(mockUpdateSet).toHaveBeenCalledWith(
			expect.objectContaining({ platform_profile_id: null })
		);
		expect(mockDeleteFn).toHaveBeenCalled();
	});

	it('returns 404 for non-existent credential', async () => {
		mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
		mockPlatformCredentialsFindFirst.mockResolvedValueOnce(null);
		await expect(
			DELETE(createDeleteEvent({ profileId: '1', credentialId: '99' }))
		).rejects.toMatchObject({ status: 404 });
	});

	it('deletes all credentials for platform when no credentialId', async () => {
		mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
		mockPlatformCredentialsFindMany.mockResolvedValueOnce([{ id: 10 }, { id: 11 }]);
		mockPlatformProfilesFindMany.mockResolvedValueOnce([{ id: 100 }]);

		const response = await DELETE(createDeleteEvent({ profileId: '1' }));
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(mockDeleteFn).toHaveBeenCalled();
		expect(mockUpdateFn).toHaveBeenCalled();
	});
});
