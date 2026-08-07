import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashToken } from '../token-generator';

const mockFindFirstToken = vi.fn();
const mockFindFirstVersion = vi.fn();

// Mock Drizzle-style update chain
const mockUpdateWhere = vi.fn().mockResolvedValue({});
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

vi.mock('$lib/server/db', () => ({
	db: {
		query: {
			profile_tokens: {
				findFirst: (...args: any[]) => mockFindFirstToken(...args)
			},
			profile_versions: {
				findFirst: (...args: any[]) => mockFindFirstVersion(...args)
			}
		},
		update: (...args: any[]) => mockUpdate(...args)
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((_col: any, val: any) => val),
	sql: vi.fn()
}));

import { validateToken, incrementTokenVisit } from '../token-validation';

describe('validateToken', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns invalid for non-existent token', async () => {
		mockFindFirstToken.mockResolvedValue(null);
		const result = await validateToken('nonexistent', 1);
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Invalid or expired access token');
	});

	it('returns invalid for unpublished token', async () => {
		mockFindFirstToken.mockResolvedValue({
			id: 1,
			status: 'draft',
			profile_version: 10,
			expires_at: null,
			visit_limit: null,
			visit_count: 0
		});
		const result = await validateToken('some-token', 1);
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Access token is no longer valid');
	});

	it("returns invalid when profile version doesn't match profile", async () => {
		mockFindFirstToken.mockResolvedValue({
			id: 1,
			status: 'published',
			profile_version: 10,
			expires_at: null,
			visit_limit: null,
			visit_count: 0
		});
		mockFindFirstVersion.mockResolvedValue({ profile_id: 999 });
		const result = await validateToken('some-token', 1);
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Access token is not valid for this profile');
	});

	it('returns invalid for expired token', async () => {
		mockFindFirstToken.mockResolvedValue({
			id: 1,
			status: 'published',
			profile_version: 10,
			expires_at: new Date('2020-01-01'),
			visit_limit: null,
			visit_count: 0
		});
		mockFindFirstVersion.mockResolvedValue({ profile_id: 1 });
		const result = await validateToken('some-token', 1);
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Access token has expired');
	});

	it('returns invalid when visit limit exceeded', async () => {
		mockFindFirstToken.mockResolvedValue({
			id: 1,
			status: 'published',
			profile_version: 10,
			expires_at: null,
			visit_limit: 5,
			visit_count: 5
		});
		mockFindFirstVersion.mockResolvedValue({ profile_id: 1 });
		const result = await validateToken('some-token', 1);
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Access token visit limit exceeded');
	});

	it('returns valid with correct profileVersionId', async () => {
		mockFindFirstToken.mockResolvedValue({
			id: 1,
			status: 'published',
			profile_version: 10,
			expires_at: null,
			visit_limit: null,
			visit_count: 0
		});
		mockFindFirstVersion.mockResolvedValue({ profile_id: 1 });
		const result = await validateToken('some-token', 1);
		expect(result).toEqual({
			valid: true,
			profileVersionId: 10,
			tokenId: 1
		});
	});

	it('returns valid when under visit limit', async () => {
		mockFindFirstToken.mockResolvedValue({
			id: 1,
			status: 'published',
			profile_version: 10,
			expires_at: null,
			visit_limit: 10,
			visit_count: 3
		});
		mockFindFirstVersion.mockResolvedValue({ profile_id: 1 });
		const result = await validateToken('some-token', 1);
		expect(result.valid).toBe(true);
	});

	it('looks up token by hash, not plain text', async () => {
		mockFindFirstToken.mockResolvedValue(null);
		await validateToken('my-token', 1);
		expect(mockFindFirstToken).toHaveBeenCalled();
	});
});

describe('incrementTokenVisit', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockUpdateWhere.mockResolvedValue({});
	});

	it('increments visit count and sets last_accessed_at', async () => {
		await incrementTokenVisit(5);
		expect(mockUpdate).toHaveBeenCalled();
		expect(mockUpdateSet).toHaveBeenCalled();
		expect(mockUpdateWhere).toHaveBeenCalled();
	});

	it('stores IP address when provided', async () => {
		await incrementTokenVisit(5, '192.168.1.1');
		expect(mockUpdate).toHaveBeenCalled();
		expect(mockUpdateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				last_accessed_ip: '192.168.1.1'
			})
		);
	});
});
