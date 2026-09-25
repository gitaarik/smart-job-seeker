/**
 * Tests for the MCP credential.
 *
 * The one that matters most is the last: a device key must not verify here, and
 * an MCP key must not look like a device key. That separation is the whole
 * reason this table exists rather than a `scope` column on `api_keys`, which two
 * independent verifiers — one of them in another repository — would not read.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { McpKeyListing } from '../keys';

const state = {
	rows: [] as Record<string, unknown>[],
	updates: [] as Record<string, unknown>[],
	failUpdates: false
};

vi.mock('$lib/server/db', () => {
	const dbMock = {
		select: () => ({
			from: () => ({
				leftJoin: () => ({
					where: () => ({
						limit: () => Promise.resolve(state.rows),
						orderBy: () => Promise.resolve(state.rows)
					})
				}),
				where: () => ({ limit: () => Promise.resolve(state.rows) })
			})
		}),
		update: () => ({
			set: (values: Record<string, unknown>) => ({
				where: () => {
					state.updates.push(values);
					return {
						// A failed write reaches its handler the way a rejected query would.
						catch: (handler: (e: unknown) => void) => {
							if (state.failUpdates) handler(new Error('column "client_name" does not exist'));
						},
						returning: () => Promise.resolve(state.rows)
					};
				}
			})
		})
	};
	return { db: dbMock, dbDirect: dbMock };
});

vi.mock('$lib/server/db/schema', () => ({
	mcp_keys: {
		id: 'id',
		key_hash: 'key_hash',
		user_id: 'user_id',
		profile_id: 'profile_id',
		revoked: 'revoked',
		date_created: 'date_created'
	},
	profiles: { id: 'profiles.id', user_id: 'profiles.user_id', name: 'profiles.name' }
}));

vi.mock('$lib/server/auth/crypto', () => ({
	encryptCredential: (value: string) => `enc:${value}`,
	decryptCredential: (value: string) => (value.startsWith('enc:') ? value.slice(4) : value)
}));

const {
	generateMcpKey,
	isAwaitingClient,
	listMcpKeys,
	MCP_CONNECT_WATCH_MS,
	MCP_KEY_PREFIX,
	mcpKeyStatus,
	readMcpClientInfo,
	readStoredMcpKey,
	recordMcpClient,
	verifyMcpKey
} = await import('../keys');

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
	state.failUpdates = false;
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

describe('readMcpClientInfo', () => {
	it('prefers the title, which the spec means for people', () => {
		expect(
			readMcpClientInfo({ name: 'claude-code', title: 'Claude Code', version: '2.1.282' })
		).toEqual({ name: 'Claude Code', version: '2.1.282' });
	});

	it('falls back to the name when the title is empty', () => {
		expect(readMcpClientInfo({ name: 'Claude Code', title: '   ', version: '2.1.282' })).toEqual({
			name: 'Claude Code',
			version: '2.1.282'
		});
	});

	it('reads a handshake that names nothing as nothing', () => {
		const nothing = { name: null, version: null };
		expect(readMcpClientInfo(undefined)).toEqual(nothing);
		expect(readMcpClientInfo('Claude Code')).toEqual(nothing);
		expect(readMcpClientInfo({ name: 42, version: {} })).toEqual(nothing);
	});

	it('keeps a name to one plain line', () => {
		// A right-to-left override turns the rest of a name around on screen, so it
		// can read as a different one. A newline breaks the row it is shown in.
		expect(readMcpClientInfo({ name: 'Claude‮ Code\n\t 2' }).name).toBe('Claude Code 2');
	});

	it('fits the columns, counting characters the way Postgres does', () => {
		const info = readMcpClientInfo({ name: `v${'🙂'.repeat(150)}`, version: '1.'.repeat(40) });
		// A cut at 100 UTF-16 units would keep 49 emoji and half of the 50th.
		expect(info.name).toBe(`v${'🙂'.repeat(99)}`);
		expect(info.version).toHaveLength(50);
	});
});

describe('recordMcpClient', () => {
	it('writes what the client said it was', () => {
		recordMcpClient(7, { name: 'Claude Code', version: '2.1.282' });
		expect(state.updates).toEqual([{ client_name: 'Claude Code', client_version: '2.1.282' }]);
	});

	it('clears an earlier client when a handshake names nothing', () => {
		// Otherwise the row would pair an old client's name with a new one's calls.
		recordMcpClient(7, undefined);
		expect(state.updates).toEqual([{ client_name: null, client_version: null }]);
	});

	it('logs a failed write rather than failing the handshake', () => {
		state.failUpdates = true;
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});

		expect(() => recordMcpClient(7, { name: 'Claude Code' })).not.toThrow();
		expect(error).toHaveBeenCalledWith(
			'[mcp] could not record the connecting client',
			expect.any(Error)
		);
		error.mockRestore();
	});
});

describe('mcpKeyStatus', () => {
	const now = new Date('2026-09-25T16:00:00Z');
	const unused = { revoked: false, expiresAt: null, lastUsed: null };

	it('is waiting until something uses the key', () => {
		expect(mcpKeyStatus(unused, now)).toBe('waiting');
		expect(mcpKeyStatus({ ...unused, lastUsed: now }, now)).toBe('connected');
	});

	it('never calls a key connected that the server would refuse', () => {
		expect(mcpKeyStatus({ ...unused, lastUsed: now, revoked: true }, now)).toBe('revoked');
		expect(
			mcpKeyStatus({ ...unused, lastUsed: now, expiresAt: new Date('2026-09-01T00:00:00Z') }, now)
		).toBe('expired');
	});
});

describe('isAwaitingClient', () => {
	const now = new Date('2026-09-25T16:00:00Z');

	function listing(overrides: Partial<McpKeyListing> = {}): McpKeyListing {
		return {
			id: 7,
			name: 'Claude Desktop',
			profileId: 12,
			profileName: 'Main',
			scope: 'propose',
			readScope: 'record',
			status: 'waiting',
			revoked: false,
			expiresAt: null,
			lastUsed: null,
			clientName: null,
			clientVersion: null,
			createdAt: new Date(now.getTime() - 60_000),
			key: null,
			...overrides
		};
	}

	it('keeps checking a new key until its client says what it is', () => {
		expect(isAwaitingClient(listing(), now)).toBe(true);
		// Used, but the client's name is a separate write that may still be landing.
		expect(isAwaitingClient(listing({ status: 'connected', lastUsed: now }), now)).toBe(true);
		expect(
			isAwaitingClient(
				listing({ status: 'connected', lastUsed: now, clientName: 'Claude Code' }),
				now
			)
		).toBe(false);
	});

	it('stops once the key is no longer new', () => {
		// Otherwise a key someone made and never used would keep every visit to
		// the page checking for good.
		const made = new Date(now.getTime() - MCP_CONNECT_WATCH_MS);
		expect(isAwaitingClient(listing({ createdAt: made }), now)).toBe(false);
	});

	it('does not wait on a key that cannot connect', () => {
		expect(isAwaitingClient(listing({ status: 'revoked', revoked: true }), now)).toBe(false);
		expect(isAwaitingClient(listing({ status: 'expired' }), now)).toBe(false);
	});
});

describe('listMcpKeys', () => {
	it('reports what connected with each key, and which are still waiting', async () => {
		const row = {
			id: 7,
			name: 'Claude Desktop',
			profile_id: 12,
			profile_name: 'Main',
			scope: 'propose',
			read_scope: 'record',
			revoked: false,
			expires_at: null,
			last_used: new Date(),
			client_name: 'Claude Code',
			client_version: '2.1.282',
			date_created: new Date(),
			key_encrypted: null
		};
		state.rows = [row, { ...row, id: 8, last_used: null, client_name: null, client_version: null }];

		const [used, unused] = await listMcpKeys('user-1');
		expect(used).toMatchObject({
			status: 'connected',
			clientName: 'Claude Code',
			clientVersion: '2.1.282'
		});
		expect(unused).toMatchObject({ status: 'waiting', clientName: null, clientVersion: null });
	});
});
