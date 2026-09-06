/**
 * Tests for the derived "when did something last happen here".
 *
 * The interesting behaviour is all in the merge: four sources, three of them
 * aggregates from other tables and one a jsonb array on the row, with the row's
 * own creation date as a floor rather than a source. The failure this module
 * exists to prevent — `date_updated` reporting a five-week-silent application
 * as fresh because a cover letter was generated — is not visible from either
 * page that calls it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { application_records, application_status_log } from '$lib/server/db/schema';

let moves: { application: number; moved: Date | null }[] = [];
let records: {
	application: number;
	happened: string | null;
	recorded: Date | null;
}[] = [];

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		select: () => ({
			from: (table: unknown) => ({
				where: () => ({
					groupBy: () =>
						Promise.resolve(
							table === application_status_log
								? moves
								: table === application_records
									? records
									: []
						)
				})
			})
		})
	}
}));

const { attachLastActivity } = await import('$lib/server/applications/activity');

beforeEach(() => {
	moves = [];
	records = [];
});

const row = (over: Record<string, unknown> = {}) => ({
	id: 1,
	date_created: new Date('2026-01-10T00:00:00Z'),
	application_sent_date: null,
	application_notes: null,
	...over
});

async function activityOf(over: Record<string, unknown> = {}) {
	const [only] = await attachLastActivity([row(over)]);
	return only.last_activity;
}

describe('attachLastActivity', () => {
	it('queries nothing for an empty list', async () => {
		expect(await attachLastActivity([])).toEqual([]);
	});

	it('falls back to the creation date when nothing else exists', async () => {
		expect(await activityOf()).toEqual(new Date('2026-01-10T00:00:00Z'));
	});

	it('takes the latest pipeline move', async () => {
		moves = [{ application: 1, moved: new Date('2026-08-01T09:00:00Z') }];
		expect(await activityOf()).toEqual(new Date('2026-08-01T09:00:00Z'));
	});

	it('takes an activity record even when the row was never moved', async () => {
		records = [{ application: 1, happened: '2026-08-20', recorded: null }];
		expect(await activityOf()).toEqual(new Date('2026-08-20T00:00:00Z'));
	});

	it('takes the later of when a record happened and when it was written down', async () => {
		// Pasting an old thread in today is you working on the application, so the
		// entry date counts even though the event it describes is older.
		records = [
			{ application: 1, happened: '2026-06-01', recorded: new Date('2026-09-01T12:00:00Z') }
		];
		expect(await activityOf()).toEqual(new Date('2026-09-01T12:00:00Z'));
	});

	it('takes the latest note', async () => {
		const notes = [{ created_at: '2026-04-01T10:00:00Z' }, { created_at: '2026-07-04T10:00:00Z' }];
		expect(await activityOf({ application_notes: notes })).toEqual(
			new Date('2026-07-04T10:00:00Z')
		);
	});

	it('takes the applied date for a row with no log and no records', async () => {
		expect(await activityOf({ application_sent_date: '2026-05-05' })).toEqual(
			new Date('2026-05-05T00:00:00Z')
		);
	});

	it('takes the latest across every source', async () => {
		moves = [{ application: 1, moved: new Date('2026-02-01T00:00:00Z') }];
		records = [
			{ application: 1, happened: '2026-03-01', recorded: new Date('2026-03-02T00:00:00Z') }
		];
		expect(
			await activityOf({
				application_sent_date: '2026-01-20',
				application_notes: [{ created_at: '2026-04-09T08:00:00Z' }]
			})
		).toEqual(new Date('2026-04-09T08:00:00Z'));
	});

	it('never reports activity in the future', async () => {
		// A scheduled interview logged ahead of time, or a mistyped year. Either
		// way it cannot have happened yet, and without the clamp a typo pins the
		// application to the top of the list forever.
		records = [{ application: 1, happened: '2999-01-01', recorded: null }];
		const at = await activityOf();
		expect(at!.getTime()).toBeLessThanOrEqual(Date.now());
	});

	it('survives a malformed note timestamp', async () => {
		const notes = [{ created_at: 'not a date' }, { created_at: '2026-07-04T10:00:00Z' }];
		expect(await activityOf({ application_notes: notes })).toEqual(
			new Date('2026-07-04T10:00:00Z')
		);
	});

	it('keeps each row to its own aggregates', async () => {
		moves = [
			{ application: 1, moved: new Date('2026-08-01T00:00:00Z') },
			{ application: 2, moved: new Date('2026-02-01T00:00:00Z') }
		];

		const rows = await attachLastActivity([row({ id: 1 }), row({ id: 2 })]);

		expect(rows[0].last_activity).toEqual(new Date('2026-08-01T00:00:00Z'));
		expect(rows[1].last_activity).toEqual(new Date('2026-02-01T00:00:00Z'));
	});

	it('does not mutate the rows it was given', async () => {
		const original = row();
		await attachLastActivity([original]);
		expect('last_activity' in original).toBe(false);
	});
});
