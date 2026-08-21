/**
 * Tests for the one write that moves an application through the pipeline.
 *
 * Three behaviours here are the reason this module exists, and none of them are
 * visible from either page that calls it:
 *
 *  - the columns and the timeline row are written together, so "where it is"
 *    and "how it got there" cannot disagree;
 *  - the applied date fills itself in the first time an application goes out,
 *    and never again;
 *  - an undo takes the timeline row back rather than appending a second one —
 *    but only while that row is still the move being undone.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

let applicationRow: Record<string, unknown> | null = null;
let logEntries: Record<string, unknown>[] = [];
let newestLogRow: Record<string, unknown>[] = [];
let nextInsertId = 500;

const updates: { table: string; values: Record<string, unknown> }[] = [];
const inserts: { table: string; values: Record<string, unknown> }[] = [];
const deletes: string[] = [];

vi.mock('$lib/server/db', () => ({
	db: {
		query: {
			applications: { findFirst: () => Promise.resolve(applicationRow) },
			application_status_log: { findMany: () => Promise.resolve(logEntries) }
		},
		update: (table: { __table: string }) => ({
			set: (values: Record<string, unknown>) => ({
				where: () => {
					updates.push({ table: table.__table, values });
					return Promise.resolve();
				}
			})
		}),
		insert: (table: { __table: string }) => ({
			values: (values: Record<string, unknown>) => ({
				returning: () => {
					inserts.push({ table: table.__table, values });
					return Promise.resolve([{ id: nextInsertId }]);
				}
			})
		}),
		delete: (table: { __table: string }) => ({
			where: () => {
				deletes.push(table.__table);
				return Promise.resolve();
			}
		}),
		select: () => ({
			from: () => ({
				where: () => ({
					orderBy: () => ({ limit: () => Promise.resolve(newestLogRow) })
				})
			})
		})
	}
}));

vi.mock('drizzle-orm', () => ({
	and: (...a: unknown[]) => a,
	desc: (c: unknown) => c,
	eq: (c: unknown, v: unknown) => [c, v]
}));

vi.mock('$lib/server/db/schema', () => ({
	applications: { __table: 'applications', id: 'applications.id', profile_id: 'applications.pid' },
	application_status_log: {
		__table: 'application_status_log',
		id: 'log.id',
		application: 'log.application',
		from_status: 'log.from_status',
		to_status: 'log.to_status'
	}
}));

import { revertApplicationStatus, writeApplicationStatus } from '../status';

const PROFILE = 12;
const APP = 49;
const TODAY = new Date().toISOString().slice(0, 10);

const move = (over: Partial<Parameters<typeof writeApplicationStatus>[2]> = {}) => ({
	status: 'interviewing',
	step: 'Technical interview',
	action: 'Scheduled',
	actionDate: '2026-09-01',
	description: null,
	...over
});

const written = () => updates.find((u) => u.table === 'applications')?.values;
const logged = () => inserts.find((i) => i.table === 'application_status_log')?.values;

beforeEach(() => {
	updates.length = 0;
	inserts.length = 0;
	deletes.length = 0;
	logEntries = [];
	newestLogRow = [];
	nextInsertId = 500;
	applicationRow = { id: APP, status: 'applying', application_sent_date: '2026-08-01' };
});

describe('writeApplicationStatus', () => {
	it('writes the stage onto the application and the move onto the timeline', async () => {
		const result = await writeApplicationStatus(APP, PROFILE, move());

		expect(written()).toMatchObject({
			status: 'interviewing',
			status_step: 'Technical interview',
			status_action: 'Scheduled',
			status_action_date: '2026-09-01'
		});
		expect(logged()).toMatchObject({
			application: APP,
			from_status: 'applying',
			to_status: 'interviewing',
			step: 'Technical interview',
			action: 'Scheduled'
		});
		expect(result).toMatchObject({ from: 'applying', logId: 500, replaced: false });
	});

	it('clears a stage the caller left out rather than carrying it over', async () => {
		// The caller decides; this does not merge. A status change that kept the
		// old stage would file "Offer received" under "Not selected".
		await writeApplicationStatus(
			APP,
			PROFILE,
			move({ status: 'rejected', step: null, action: null })
		);

		expect(written()).toMatchObject({ status_step: null, status_action: null });
	});

	it('fills in the applied date the first time it goes out', async () => {
		applicationRow = { id: APP, status: 'applying', application_sent_date: null };

		const result = await writeApplicationStatus(
			APP,
			PROFILE,
			move({ status: 'applying', step: 'E-mail sent', action: 'Awaiting response' })
		);

		// A date string, not a Date: the column is a Drizzle `date()` in string
		// mode, and a Date is serialized in the server's timezone.
		expect(written()?.application_sent_date).toBe(TODAY);
		expect(result?.appliedDateSet).toBe(TODAY);
	});

	it('leaves a date the applicant typed alone', async () => {
		await writeApplicationStatus(APP, PROFILE, move());

		expect(written()).not.toHaveProperty('application_sent_date');
	});

	it('does not treat still-preparing as sent', async () => {
		applicationRow = { id: APP, status: 'applying', application_sent_date: null };

		await writeApplicationStatus(
			APP,
			PROFILE,
			move({ status: 'applying', step: 'Preparing', action: 'Send application' })
		);

		expect(written()).not.toHaveProperty('application_sent_date');
	});

	it('rewrites the creation entry when the editor is correcting it', async () => {
		logEntries = [{ id: 7, from_status: null }];

		const result = await writeApplicationStatus(
			APP,
			PROFILE,
			move({ status: 'applying', step: 'E-mail sent', action: 'Awaiting response' }),
			{ collapseInitialEntry: true }
		);

		expect(inserts).toHaveLength(0);
		expect(updates.filter((u) => u.table === 'application_status_log')).toHaveLength(1);
		expect(result).toMatchObject({ logId: 7, replaced: true });
	});

	it('adds a row instead once the status itself has moved', async () => {
		logEntries = [{ id: 7, from_status: null }];

		const result = await writeApplicationStatus(APP, PROFILE, move(), {
			collapseInitialEntry: true
		});

		expect(result).toMatchObject({ replaced: false });
		expect(logged()).toMatchObject({ from_status: 'applying', to_status: 'interviewing' });
	});

	it('adds a row once there is a history to add to', async () => {
		logEntries = [
			{ id: 7, from_status: null },
			{ id: 8, from_status: 'applying' }
		];

		const result = await writeApplicationStatus(
			APP,
			PROFILE,
			move({ status: 'applying', step: 'E-mail sent', action: 'Awaiting response' }),
			{ collapseInitialEntry: true }
		);

		expect(result).toMatchObject({ replaced: false });
	});

	it('writes nothing for an application that is not this profile’s', async () => {
		applicationRow = null;

		expect(await writeApplicationStatus(APP, PROFILE, move())).toBeNull();
		expect(updates).toHaveLength(0);
		expect(inserts).toHaveLength(0);
	});
});

describe('revertApplicationStatus', () => {
	const before = {
		status: 'applying',
		step: 'Applied through job platform',
		action: 'Awaiting response',
		actionDate: null,
		description: null
	};

	it('takes back the row its own change added', async () => {
		applicationRow = { id: APP, status: 'interviewing', application_sent_date: '2026-08-01' };
		newestLogRow = [{ id: 88, from_status: 'applying', to_status: 'interviewing' }];

		expect(await revertApplicationStatus(APP, PROFILE, before)).toBe(true);

		expect(written()).toMatchObject({
			status: 'applying',
			status_step: 'Applied through job platform',
			status_action: 'Awaiting response'
		});
		expect(deletes).toEqual(['application_status_log']);
		expect(inserts).toHaveLength(0);
	});

	it('records the move back instead when something else has moved it since', async () => {
		// Deleting here would erase an edit the applicant made by hand. The move
		// back is a real event now, so it is logged as one.
		applicationRow = { id: APP, status: 'rejected', application_sent_date: '2026-08-01' };
		newestLogRow = [{ id: 89, from_status: 'interviewing', to_status: 'rejected' }];

		expect(await revertApplicationStatus(APP, PROFILE, before)).toBe(true);

		expect(deletes).toHaveLength(0);
		expect(logged()).toMatchObject({ from_status: 'rejected', to_status: 'applying' });
	});

	it('never deletes the creation entry', async () => {
		applicationRow = { id: APP, status: 'applying', application_sent_date: null };
		newestLogRow = [{ id: 1, from_status: null, to_status: 'applying' }];

		await revertApplicationStatus(APP, PROFILE, before);

		expect(deletes).toHaveLength(0);
	});

	it('does nothing for an application that is not this profile’s', async () => {
		applicationRow = null;

		expect(await revertApplicationStatus(APP, PROFILE, before)).toBe(false);
		expect(updates).toHaveLength(0);
		expect(deletes).toHaveLength(0);
	});
});
