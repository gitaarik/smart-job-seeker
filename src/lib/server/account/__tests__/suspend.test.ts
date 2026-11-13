/**
 * Suspension revokes access the way an erasure request does, and only once.
 *
 * The property worth pinning is the guard on the first write: a second
 * suspend must not move `suspended_at` or revoke again, and a suspend of an
 * account that is not there must not revoke anything. The DB is mocked, so this
 * proves the operations issued, not what Postgres does with them.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Op = { kind: 'update' | 'delete'; table: string; values?: Record<string, unknown> };
const ops: Op[] = [];
/** rowCount for the next `users` update. */
let usersUpdated = 1;

vi.mock('drizzle-orm', () => ({
	eq: (a: unknown, b: unknown) => ({ op: 'eq', a, b }),
	and: (...a: unknown[]) => ({ op: 'and', a }),
	isNull: (a: unknown) => ({ op: 'isNull', a }),
	isNotNull: (a: unknown) => ({ op: 'isNotNull', a }),
	lte: (a: unknown, b: unknown) => ({ op: 'lte', a, b }),
	sql: Object.assign(() => ({ op: 'sql' }), { raw: () => ({ op: 'raw' }) })
}));

vi.mock('$lib/server/db/schema', () => {
	// vitest checks a mock's exports by name, so the tables are listed rather
	// than conjured by a proxy. Columns are addressed as `table.col`.
	const names = [
		'account_deletions',
		'api_keys',
		'billing_customers',
		'credential_shares',
		'credit_purchases',
		'demo_links',
		'device_shares',
		'import_logs',
		'mcp_keys',
		'notifications',
		'profiles',
		'search_tasks',
		'sent_emails',
		'sessions',
		'subscriptions',
		'user_feedback',
		'users'
	];
	const out: Record<string, unknown> = {};
	for (const n of names) {
		out[n] = new Proxy(
			{ __table: n },
			{ get: (_t, k) => (k === '__table' ? n : `${n}.${String(k)}`) }
		);
	}
	return out;
});

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		update: (t: { __table: string }) => ({
			set: (v: Record<string, unknown>) => ({
				where: () => {
					ops.push({ kind: 'update', table: t.__table, values: v });
					return Promise.resolve({ rowCount: t.__table === 'users' ? usersUpdated : 1 });
				}
			})
		}),
		delete: (t: { __table: string }) => ({
			where: () => {
				ops.push({ kind: 'delete', table: t.__table });
				return Promise.resolve({ rowCount: 1 });
			}
		})
	}
}));

vi.mock('$lib/server/profile/delete', () => ({ deleteProfile: vi.fn() }));
vi.mock('$lib/server/uploads/reap', () => ({
	collectUserFileRefs: vi.fn(),
	reapFileRefs: vi.fn()
}));

const { suspendAccount, unsuspendAccount } = await import('../suspend');

beforeEach(() => {
	ops.length = 0;
	usersUpdated = 1;
});

describe('suspendAccount', () => {
	it('stamps the account first, then revokes its access', async () => {
		await expect(suspendAccount('u1', ' chargeback ')).resolves.toBe(true);

		expect(ops[0]).toMatchObject({ kind: 'update', table: 'users' });
		expect(ops[0].values).toMatchObject({ suspended_reason: 'chargeback' });
		expect(ops[0].values?.suspended_at).toBeInstanceOf(Date);

		const touched = ops.slice(1).map((o) => `${o.kind}:${o.table}`);
		expect(touched).toEqual([
			'delete:sessions',
			'update:api_keys',
			'update:mcp_keys',
			'delete:device_shares',
			'delete:credential_shares',
			'update:demo_links',
			'update:search_tasks'
		]);
	});

	it('pauses searches at the suspension time', async () => {
		await suspendAccount('u1', 'abuse');
		const at = ops[0].values?.suspended_at;
		const searches = ops.find((o) => o.table === 'search_tasks');
		expect(searches?.values).toEqual({ is_active: false, user_paused_at: at });
	});

	it('stores no reason rather than an empty one', async () => {
		await suspendAccount('u1', '   ');
		expect(ops[0].values?.suspended_reason).toBeNull();
	});

	it('revokes nothing when the account is missing or already suspended', async () => {
		usersUpdated = 0;
		await expect(suspendAccount('u1', 'again')).resolves.toBe(false);
		expect(ops.map((o) => o.table)).toEqual(['users']);
	});
});

describe('unsuspendAccount', () => {
	it('clears the date and the reason, and restores nothing else', async () => {
		await expect(unsuspendAccount('u1')).resolves.toBe(true);
		expect(ops).toEqual([
			{
				kind: 'update',
				table: 'users',
				values: { suspended_at: null, suspended_reason: null }
			}
		]);
	});

	it('says so when the account was not suspended', async () => {
		usersUpdated = 0;
		await expect(unsuspendAccount('u1')).resolves.toBe(false);
	});
});
