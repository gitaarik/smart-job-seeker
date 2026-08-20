/**
 * Tests for the MCP credential.
 *
 * The one that matters most is the last: a device key must not verify here, and
 * an MCP key must not look like a device key. That separation is the whole
 * reason this table exists rather than a `scope` column on `api_keys`, which two
 * independent verifiers — one of them in another repository — would not read.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
	rows: [] as Record<string, unknown>[],
	updates: [] as Record<string, unknown>[]
};

vi.mock('$lib/server/db', () => {
	const dbMock = {
		select: () => ({
			from: () => ({
				leftJoin: () => ({
					where: () => ({ limit: () => Promise.resolve(state.rows) })
				}),
				where: () => ({ limit: () => Promise.resolve(state.rows) })
			})
		}),
		update: () => ({
			set: (values: Record<string, unknown>) => ({
				where: () => {
					state.updates.push(values);
					return { catch: () => undefined, returning: () => Promise.resolve(state.rows) };
				}
			})
		})
	};
	return { db: dbMock, dbDirect: dbMock };
});

vi.mock('$lib/server/db/schema', () => ({
	mcp_keys: { id: 'id', key_hash: 'key_hash', user_id: 'user_id', revoked: 'revoked' },
	profiles: { id: 'profiles.id', user_id: 'profiles.user_id', name: 'profiles.name' }
}));

vi.mock('$lib/server/auth/crypto', () => ({
	encryptCredential: (value: string) => `enc:${value}`,
	decryptCredential: (value: string) => (value.startsWith('enc:') ? value.slice(4) : value)
}));

const { generateMcpKey, MCP_KEY_PREFIX, readStoredMcpKey, verifyMcpKey } = await import('../keys');

function keyRow(overrides: Record<string, unknown> = {}) {
	return {
		id: 7,
		user_id: 'user-1',
		profile_id: 12,
		scope: 'propose',
		read_scope: 'record',
		name: 'Claude Desktop',
		revoked: false,
		expires_at: null,
		owner_id: 'user-1',
		...overrides
	};
}

beforeEach(() => {
	state.rows = [];
	state.updates = [];
});

describe('generateMcpKey', () => {
	it('is distinguishable from a device key before any lookup', () => {
		// `sjs_` is the device prefix. A key that started with it would be handed to
		// the tunnel verifier by anyone who pasted it in the wrong box, and that
		// verifier grants control of a browser.
		const { key } = generateMcpKey();
		expect(key.startsWith(MCP_KEY_PREFIX)).toBe(true);
		expect(key.startsWith('sjs_')).toBe(false);
	});
});

describe('verifyMcpKey', () => {
	it('returns the profile and scope the key is bound to', async () => {
		state.rows = [keyRow()];

		const verified = await verifyMcpKey(`${MCP_KEY_PREFIX}abc`);
		expect(verified).toMatchObject({
			keyId: 7,
			profileId: 12,
			scope: 'propose',
			readScope: 'record'
		});
	});

	it('refuses a device key outright', async () => {
		// Not by failing to find it — by never looking. A device key and an MCP key
		// could in principle hash to rows in both tables.
		state.rows = [keyRow()];
		expect(await verifyMcpKey('sjs_deadbeef')).toBeNull();
	});

	it('refuses a revoked key', async () => {
		state.rows = [keyRow({ revoked: true })];
		expect(await verifyMcpKey(`${MCP_KEY_PREFIX}abc`)).toBeNull();
	});

	it('refuses an expired key', async () => {
		state.rows = [keyRow({ expires_at: new Date('2020-01-01') })];
		expect(await verifyMcpKey(`${MCP_KEY_PREFIX}abc`)).toBeNull();
	});

	it('refuses a key whose profile is no longer its owner’s', async () => {
		// The cascade covers a deleted profile. This covers one that changed hands,
		// which nothing else would catch — the key row itself still looks valid.
		state.rows = [keyRow({ owner_id: 'someone-else' })];
		expect(await verifyMcpKey(`${MCP_KEY_PREFIX}abc`)).toBeNull();
	});

	it('refuses a key whose profile is gone', async () => {
		// A left join with no match: `owner_id` is null and matches no user id.
		state.rows = [keyRow({ owner_id: null })];
		expect(await verifyMcpKey(`${MCP_KEY_PREFIX}abc`)).toBeNull();
	});

	it('refuses a scope it does not recognise', async () => {
		// The column is text, so a hand-edited row is possible. Failing closed
		// beats defaulting to something.
		state.rows = [keyRow({ scope: 'admin' })];
		expect(await verifyMcpKey(`${MCP_KEY_PREFIX}abc`)).toBeNull();
	});

	it('stamps last_used without letting a failure fail the call', async () => {
		state.rows = [keyRow()];
		await verifyMcpKey(`${MCP_KEY_PREFIX}abc`);
		expect(state.updates[0]).toHaveProperty('last_used');
	});
});

describe('readStoredMcpKey', () => {
	it('returns null for a value that is not a key', () => {
		// decryptCredential passes non-ciphertext through unchanged, so "failed to
		// decrypt" and "was never encrypted" are the same return value. The shape is
		// what tells them apart.
		expect(readStoredMcpKey('garbage')).toBeNull();
		expect(readStoredMcpKey(null)).toBeNull();
	});

	it('returns a key that round-trips', () => {
		expect(readStoredMcpKey(`enc:${MCP_KEY_PREFIX}abc`)).toBe(`${MCP_KEY_PREFIX}abc`);
	});
});
