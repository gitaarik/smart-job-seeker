/**
 * Tests for the device-invite link flow.
 *
 * Focus is on the security / correctness invariants of the new code:
 *   - createDeviceInvite refuses devices the caller doesn't own
 *   - getDeviceInvite rejects unknown tokens and wrong-kind payloads
 *   - acceptDeviceInvite refuses self-accept (inviter == invitee)
 *   - acceptDeviceInvite establishes an accepted contact, shares the device,
 *     and consumes the invite on success
 *   - an already-existing share is treated as success (idempotent accept)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock query.findFirst per table ─────────────────────────────────────────
const mockApiKeysFindFirst = vi.fn();
const mockDeviceSharesFindFirst = vi.fn();
const mockUsersFindFirst = vi.fn();
const mockVerificationsFindFirst = vi.fn();

// ── Mock Drizzle insert / delete chains ────────────────────────────────────
const mockInsertValues = vi.fn().mockResolvedValue({});
const mockInsertFn = vi.fn().mockReturnValue({ values: mockInsertValues });
const mockDeleteWhere = vi.fn().mockResolvedValue({ rowCount: 1 });
const mockDeleteFn = vi.fn().mockReturnValue({ where: mockDeleteWhere });

vi.mock('$lib/server/db', () => ({
	db: {
		query: {
			api_keys: { findFirst: (...a: any[]) => mockApiKeysFindFirst(...a) },
			device_shares: {
				findFirst: (...a: any[]) => mockDeviceSharesFindFirst(...a)
			},
			users: { findFirst: (...a: any[]) => mockUsersFindFirst(...a) },
			verifications: {
				findFirst: (...a: any[]) => mockVerificationsFindFirst(...a)
			}
		},
		insert: (...a: any[]) => mockInsertFn(...a),
		delete: (...a: any[]) => mockDeleteFn(...a)
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((col: any, val: any) => ({ kind: 'eq', col, val })),
	and: vi.fn((...args: any[]) => ({ kind: 'and', args })),
	desc: vi.fn((col: any) => ({ kind: 'desc', col })),
	gt: vi.fn((col: any, val: any) => ({ kind: 'gt', col, val })),
	inArray: vi.fn((col: any, vals: any[]) => ({ kind: 'in', col, vals }))
}));

vi.mock('$lib/server/db/schema', () => ({
	api_keys: {
		id: 'api_keys.id',
		user_id: 'api_keys.user_id',
		revoked: 'api_keys.revoked'
	},
	device_shares: {
		api_key_id: 'device_shares.api_key_id',
		shared_with: 'device_shares.shared_with'
	},
	users: { id: 'users.id' },
	verifications: {
		id: 'verifications.id',
		identifier: 'verifications.identifier',
		expiresAt: 'verifications.expiresAt'
	}
}));

const mockEnsureAcceptedContact = vi.fn().mockResolvedValue(undefined);
vi.mock('$lib/server/contacts', () => ({
	areContacts: vi.fn(),
	ensureAcceptedContact: (...a: any[]) => mockEnsureAcceptedContact(...a)
}));

const mockCreateNotification = vi.fn().mockResolvedValue(undefined);
vi.mock('$lib/server/notifications', () => ({
	createNotification: (...a: any[]) => mockCreateNotification(...a)
}));

vi.mock('$lib/server/credential-shares', () => ({
	revokeOrphanedCredentialShares: vi.fn()
}));

vi.mock('node:crypto', () => ({
	randomBytes: vi.fn(() => ({ toString: () => 'deadbeef' }))
}));

import { acceptDeviceInvite, createDeviceInvite, getDeviceInvite } from '$lib/server/device-shares';

function inviteRow(payload: Record<string, unknown>) {
	return { id: 'ver-1', value: JSON.stringify(payload) };
}

const VALID_PAYLOAD = {
	token: 'tok',
	kind: 'device-share',
	inviterId: 'alice',
	apiKeyId: 42
};

beforeEach(() => {
	vi.clearAllMocks();
	mockInsertFn.mockReturnValue({ values: mockInsertValues });
	mockDeleteFn.mockReturnValue({ where: mockDeleteWhere });
	mockDeleteWhere.mockResolvedValue({ rowCount: 1 });
});

describe('createDeviceInvite', () => {
	it('refuses a device the caller does not own', async () => {
		mockApiKeysFindFirst.mockResolvedValue(undefined);
		const res = await createDeviceInvite(42, 'alice');
		expect(res.success).toBe(false);
		expect(res.error).toBe('Device not found');
		expect(mockInsertFn).not.toHaveBeenCalled();
	});

	it('mints and stores an invite for an owned device', async () => {
		mockApiKeysFindFirst.mockResolvedValue({ id: 42 });
		const res = await createDeviceInvite(42, 'alice');
		expect(res.success).toBe(true);
		expect(res.token).toBe('deadbeef');
		expect(mockInsertValues).toHaveBeenCalledOnce();
		const stored = mockInsertValues.mock.calls[0][0];
		expect(stored.identifier).toBe('device-invite:deadbeef');
		expect(JSON.parse(stored.value)).toMatchObject({
			kind: 'device-share',
			inviterId: 'alice',
			apiKeyId: 42
		});
	});
});

describe('getDeviceInvite', () => {
	it('returns null for an unknown / expired token', async () => {
		mockVerificationsFindFirst.mockResolvedValue(undefined);
		expect(await getDeviceInvite('nope')).toBeNull();
	});

	it('returns null when the payload is not a device-share invite', async () => {
		mockVerificationsFindFirst.mockResolvedValue(
			inviteRow({ ...VALID_PAYLOAD, kind: 'something-else' })
		);
		expect(await getDeviceInvite('tok')).toBeNull();
	});

	it('resolves inviter and device names for a valid invite', async () => {
		mockVerificationsFindFirst.mockResolvedValue(inviteRow(VALID_PAYLOAD));
		mockUsersFindFirst.mockResolvedValue({ name: 'Alice', email: 'a@x.io' });
		mockApiKeysFindFirst.mockResolvedValue({ name: "Alice's NAS" });
		const info = await getDeviceInvite('tok');
		expect(info).toMatchObject({
			inviterId: 'alice',
			apiKeyId: 42,
			inviterName: 'Alice',
			deviceName: "Alice's NAS"
		});
	});
});

describe('acceptDeviceInvite', () => {
	it('rejects an invalid token', async () => {
		mockVerificationsFindFirst.mockResolvedValue(undefined);
		const res = await acceptDeviceInvite('nope', 'bob');
		expect(res.success).toBe(false);
		expect(mockEnsureAcceptedContact).not.toHaveBeenCalled();
	});

	it('refuses self-accept (inviter is the invitee)', async () => {
		mockVerificationsFindFirst.mockResolvedValue(inviteRow(VALID_PAYLOAD));
		mockUsersFindFirst.mockResolvedValue({ name: 'Alice' });
		mockApiKeysFindFirst.mockResolvedValue({ name: 'NAS' });
		const res = await acceptDeviceInvite('tok', 'alice');
		expect(res.success).toBe(false);
		expect(res.error).toMatch(/your own/i);
		expect(mockEnsureAcceptedContact).not.toHaveBeenCalled();
		expect(mockInsertFn).not.toHaveBeenCalled();
	});

	it('makes an accepted contact, shares the device, and consumes the invite', async () => {
		mockVerificationsFindFirst.mockResolvedValue(inviteRow(VALID_PAYLOAD));
		// getDeviceInvite: inviter + device lookups; insertDeviceShare: owner lookup
		mockUsersFindFirst.mockResolvedValue({ name: 'Alice', email: 'a@x.io' });
		mockApiKeysFindFirst.mockResolvedValue({ id: 42, name: 'NAS' });
		mockDeviceSharesFindFirst.mockResolvedValue(undefined); // not yet shared

		const res = await acceptDeviceInvite('tok', 'bob');

		expect(res.success).toBe(true);
		expect(mockEnsureAcceptedContact).toHaveBeenCalledWith('alice', 'bob');
		// device share inserted
		expect(mockInsertValues).toHaveBeenCalledWith({
			api_key_id: 42,
			shared_with: 'bob'
		});
		// invite consumed
		expect(mockDeleteFn).toHaveBeenCalled();
	});

	it('treats an already-existing share as success', async () => {
		mockVerificationsFindFirst.mockResolvedValue(inviteRow(VALID_PAYLOAD));
		mockUsersFindFirst.mockResolvedValue({ name: 'Alice' });
		mockApiKeysFindFirst.mockResolvedValue({ id: 42, name: 'NAS' });
		mockDeviceSharesFindFirst.mockResolvedValue({ id: 7 }); // already shared

		const res = await acceptDeviceInvite('tok', 'bob');

		expect(res.success).toBe(true);
		expect(mockDeleteFn).toHaveBeenCalled(); // invite still consumed
	});
});
