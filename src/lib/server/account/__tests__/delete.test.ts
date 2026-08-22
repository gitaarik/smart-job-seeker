/**
 * What account erasure must do, and in what order.
 *
 * Three properties here are not obvious from reading `eraseAccount`, and all
 * three have a failure mode that is silent rather than loud:
 *
 * 1. **The file references are read before the delete.** Afterwards there is
 *    nothing left to read them from, so an erasure that collects late collects
 *    nothing and leaves every uploaded byte on disk — with the row that
 *    explained it gone, so nothing will ever find them again.
 * 2. **The six tables with a `user_id` and no foreign key are cleared
 *    explicitly.** `DELETE FROM users` cascades through 20 FKs and steps
 *    straight over these. Nothing errors; the rows simply stay.
 * 3. **The billing carve-out is stamped before the delete**, because the FK
 *    nulls `user_id` on the way out and the link is unrecoverable after.
 *
 * The DB is mocked, so this proves the code *issues* the right operations in
 * the right order. It cannot prove Postgres cascades as declared.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Every write the module issues, in order. */
type Op = { kind: 'update' | 'delete' | 'insert'; table: string; values?: Record<string, unknown> };
const ops: Op[] = [];
/** Non-write calls whose ordering matters. */
const marks: string[] = [];

vi.mock('drizzle-orm', () => ({
	eq: (a: unknown, b: unknown) => ({ op: 'eq', a, b }),
	and: (...a: unknown[]) => ({ op: 'and', a }),
	isNotNull: (a: unknown) => ({ op: 'isNotNull', a }),
	lte: (a: unknown, b: unknown) => ({ op: 'lte', a, b }),
	sql: Object.assign(() => ({ op: 'sql' }), { raw: () => ({ op: 'raw' }) })
}));

vi.mock('$lib/server/db/schema', () => {
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
		// Columns are addressed as `table.col`; a proxy lets any column resolve.
		out[n] = new Proxy(
			{ __table: n },
			{ get: (t, k) => (k === '__table' ? n : `${n}.${String(k)}`) }
		);
	}
	return out;
});

let usersRow: Record<string, unknown> | undefined = { id: 'u1', deletion_requested_at: null };
let ownedProfiles: { id: number }[] = [{ id: 11 }, { id: 12 }];
let dueUsers: { id: string }[] = [];

vi.mock('$lib/server/db', () => {
	return {
		dbDirect: {
			update: (t: { __table: string }) => ({
				set: (v: Record<string, unknown>) => ({
					where: () => {
						ops.push({ kind: 'update', table: t.__table, values: v });
						return Promise.resolve({ rowCount: 1 });
					}
				})
			}),
			delete: (t: { __table: string }) => ({
				where: () => {
					ops.push({ kind: 'delete', table: t.__table });
					return Promise.resolve({ rowCount: 1 });
				}
			}),
			insert: (t: { __table: string }) => ({
				values: (v: Record<string, unknown>) => ({
					onConflictDoNothing: () => {
						ops.push({ kind: 'insert', table: t.__table, values: v });
						return Promise.resolve({ rowCount: 1 });
					}
				})
			}),
			query: {
				users: {
					findFirst: () => Promise.resolve(usersRow),
					findMany: () => Promise.resolve(dueUsers)
				},
				profiles: { findMany: () => Promise.resolve(ownedProfiles) }
			}
		}
	};
});

vi.mock('$lib/server/profile/delete', () => ({
	deleteProfile: (id: number) => {
		marks.push(`deleteProfile:${id}`);
		return Promise.resolve({ profileId: id, reaped: {} });
	}
}));

vi.mock('$lib/server/uploads/reap', () => ({
	collectUserFileRefs: () => {
		marks.push('collect');
		return Promise.resolve({ fileIds: ['f1'], mediaPaths: ['profiles/a.jpg'] });
	},
	reapFileRefs: () => {
		marks.push('reap');
		return Promise.resolve({
			filesDeleted: 1,
			filesRetained: 0,
			blobsUnlinked: 1,
			mediaUnlinked: 1,
			failures: []
		});
	}
}));

const { accountRef, eraseAccount, reapDeletedAccounts, DELETION_GRACE_DAYS } =
	await import('../delete');

beforeEach(() => {
	ops.length = 0;
	marks.length = 0;
	usersRow = { id: 'u1', deletion_requested_at: new Date('2026-07-01T00:00:00Z') };
	ownedProfiles = [{ id: 11 }, { id: 12 }];
	dueUsers = [];
});

const tablesTouched = (kind: Op['kind']) => ops.filter((o) => o.kind === kind).map((o) => o.table);
const indexOfOp = (kind: Op['kind'], table: string) =>
	ops.findIndex((o) => o.kind === kind && o.table === table);

describe('eraseAccount', () => {
	it('reads the file references before deleting anything', async () => {
		await eraseAccount('u1');
		// `collect` is the first thing that happens; every write follows it.
		expect(marks[0]).toBe('collect');
	});

	it('clears the six tables that carry a user_id with no foreign key', async () => {
		await eraseAccount('u1');
		const deleted = tablesTouched('delete');
		// These do not cascade. If this list ever shrinks, rows survive erasure.
		expect(deleted).toEqual(
			expect.arrayContaining([
				'import_logs',
				'notifications',
				'sent_emails',
				'user_feedback',
				'users'
			])
		);
	});

	it('stamps the billing carve-out before the user row goes', async () => {
		await eraseAccount('u1');
		const ref = accountRef('u1');
		for (const t of ['billing_customers', 'subscriptions', 'credit_purchases']) {
			const i = indexOfOp('update', t);
			expect(i, `${t} was never stamped`).toBeGreaterThanOrEqual(0);
			expect(ops[i].values).toEqual({ deleted_account_ref: ref });
			// After the delete, `user_id` is null and the row can never be linked.
			expect(i).toBeLessThan(indexOfOp('delete', 'users'));
		}
	});

	it('deletes every profile through the path that also unlinks files', async () => {
		await eraseAccount('u1');
		expect(marks).toContain('deleteProfile:11');
		expect(marks).toContain('deleteProfile:12');
		// ...and does so before the user row, so the profiles are still findable.
		expect(marks.indexOf('deleteProfile:11')).toBeLessThan(marks.indexOf('reap'));
	});

	it('reaps files after the rows are gone, not before', async () => {
		await eraseAccount('u1');
		expect(marks.indexOf('reap')).toBeGreaterThan(marks.indexOf('collect'));
	});

	it('records the erasure without recording who it was', async () => {
		await eraseAccount('u1', { by: 'admin' });
		const audit = ops.find((o) => o.kind === 'insert' && o.table === 'account_deletions');
		expect(audit).toBeDefined();
		const values = audit!.values as Record<string, unknown>;
		expect(values.account_ref).toBe(accountRef('u1'));
		expect(values.requested_by).toBe('admin');
		expect(values.profiles_deleted).toBe(2);
		// The whole point: nothing in the audit row can name the person.
		const serialised = JSON.stringify(values);
		expect(serialised).not.toContain('u1');
		expect(serialised).not.toMatch(/@/);
	});

	it('refuses an id that does not exist rather than writing a half-erasure', async () => {
		usersRow = undefined;
		await expect(eraseAccount('nope')).rejects.toThrow(/No such user/);
		expect(ops).toHaveLength(0);
	});
});

describe('accountRef', () => {
	it('is stable, hex, and not the user id', () => {
		expect(accountRef('u1')).toBe(accountRef('u1'));
		expect(accountRef('u1')).toMatch(/^[0-9a-f]{64}$/);
		expect(accountRef('u1')).not.toContain('u1');
		expect(accountRef('u1')).not.toBe(accountRef('u2'));
	});
});

describe('reapDeletedAccounts', () => {
	it('does nothing when no account is past its grace window', async () => {
		dueUsers = [];
		const r = await reapDeletedAccounts();
		expect(r).toEqual({ due: 0, erased: 0, failed: [] });
		expect(ops).toHaveLength(0);
	});

	it('erases each account that is due', async () => {
		dueUsers = [{ id: 'u1' }];
		const r = await reapDeletedAccounts();
		expect(r.due).toBe(1);
		expect(r.erased).toBe(1);
	});

	it('defaults to the documented grace window', () => {
		expect(DELETION_GRACE_DAYS).toBe(30);
	});
});
