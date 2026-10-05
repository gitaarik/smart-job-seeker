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

import {
	RELABELLED_STATUSES,
	revertApplicationStatus,
	statusForModel,
	writeApplicationStatus
} from '../status';

const PROFILE = 12;
const APP = 49;
const TODAY = new Date().toISOString().slice(0, 10);

const technical = { kind: 'Technical', date: '2026-09-01', time: '10:00', with: null };

const move = (over: Partial<Parameters<typeof writeApplicationStatus>[2]> = {}) => ({
	status: 'interviewing',
	step: null,
	rounds: [technical],
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
	applicationRow = {
		id: APP,
		status: 'applying',
		status_step: 'Applied',
		interview_rounds: [],
		application_sent_date: '2026-08-01'
	};
});

describe('writeApplicationStatus', () => {
	it('writes the rounds onto the application and the latest round onto the timeline', async () => {
		const result = await writeApplicationStatus(APP, PROFILE, move());

		expect(written()).toMatchObject({
			status: 'interviewing',
			status_step: null,
			interview_rounds: [technical]
		});
		expect(logged()).toMatchObject({
			application: APP,
			from_status: 'applying',
			to_status: 'interviewing',
			step: 'Round 1 · Technical',
			action_date: '2026-09-01'
		});
		// Nothing writes the old next-action column any more.
		expect(logged()).not.toHaveProperty('action');
		expect(result).toMatchObject({ from: 'applying', logId: 500, replaced: false });
	});

	it('names the round just added when two are booked at once', async () => {
		applicationRow = {
			...applicationRow,
			status: 'interviewing',
			status_step: null,
			interview_rounds: [technical]
		};
		const team = { kind: 'Team', date: '2026-09-03', time: null, with: null };

		await writeApplicationStatus(APP, PROFILE, move({ rounds: [technical, team] }));

		expect(logged()).toMatchObject({ step: 'Round 2 · Team', action_date: '2026-09-03' });
	});

	it('gives an application moved into interviewing its first round, booked or not', async () => {
		await writeApplicationStatus(APP, PROFILE, move({ rounds: [] }));

		expect(written()?.interview_rounds).toEqual([
			{ kind: null, date: null, time: null, with: null }
		]);
		expect(logged()).toMatchObject({ step: 'Round 1', action_date: null });
	});

	it('drops a stage the status does not have, rather than carrying it over', async () => {
		// The caller decides; this does not merge. A status change that kept the
		// old stage would file "Offer received" under "Not selected".
		await writeApplicationStatus(
			APP,
			PROFILE,
			move({ status: 'rejected', step: 'Offer received' })
		);
		expect(written()).toMatchObject({ status: 'rejected', status_step: null });

		updates.length = 0;
		await writeApplicationStatus(APP, PROFILE, move({ step: 'Technical interview' }));
		expect(written()).toMatchObject({ status: 'interviewing', status_step: null });
	});

	it('keeps the rounds past the interviews, and clears them on a move back to applying', async () => {
		applicationRow = {
			...applicationRow,
			status: 'interviewing',
			status_step: null,
			interview_rounds: [technical]
		};

		// Sent without rounds: a quick "Not selected" has nothing to say about them.
		await writeApplicationStatus(APP, PROFILE, {
			status: 'rejected',
			step: null,
			description: null
		});
		expect(written()?.interview_rounds).toEqual([technical]);

		updates.length = 0;
		await writeApplicationStatus(APP, PROFILE, {
			status: 'applying',
			step: 'Applied',
			description: null
		});
		expect(written()?.interview_rounds).toEqual([]);
	});

	it('writes no timeline row when only who a round is with changed', async () => {
		applicationRow = {
			...applicationRow,
			status: 'interviewing',
			status_step: null,
			interview_rounds: [technical]
		};

		const result = await writeApplicationStatus(
			APP,
			PROFILE,
			move({ rounds: [{ ...technical, with: 'Anna (CTO)' }] })
		);

		expect(written()?.interview_rounds).toEqual([{ ...technical, with: 'Anna (CTO)' }]);
		expect(inserts).toHaveLength(0);
		expect(result).toMatchObject({ logId: null });
	});

	it('writes a row for a reschedule, carrying the new day', async () => {
		applicationRow = {
			...applicationRow,
			status: 'interviewing',
			status_step: null,
			interview_rounds: [technical]
		};

		await writeApplicationStatus(
			APP,
			PROFILE,
			move({ rounds: [{ ...technical, date: '2026-09-04' }] })
		);

		expect(logged()).toMatchObject({ step: 'Round 1 · Technical', action_date: '2026-09-04' });
	});

	it('writes a row for a note even when nothing else moved', async () => {
		applicationRow = {
			...applicationRow,
			status: 'interviewing',
			status_step: null,
			interview_rounds: [technical]
		};

		await writeApplicationStatus(
			APP,
			PROFILE,
			move({ description: 'They want a portfolio walk-through' })
		);

		expect(logged()).toMatchObject({ description: 'They want a portfolio walk-through' });
	});

	it('fills in the applied date the first time it goes out', async () => {
		applicationRow = { ...applicationRow, status_step: 'Preparing', application_sent_date: null };

		const result = await writeApplicationStatus(
			APP,
			PROFILE,
			move({ status: 'applying', step: 'Applied', rounds: [] })
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

	it('does not date an application that ended before it went out', async () => {
		// The date is the only thing telling "closed before I applied" from
		// "closed after", so filling it in here would erase the difference.
		for (const status of ['position_closed', 'withdrawn']) {
			updates.length = 0;
			applicationRow = { ...applicationRow, status_step: 'Preparing', application_sent_date: null };

			const result = await writeApplicationStatus(
				APP,
				PROFILE,
				move({ status, step: null, rounds: [] })
			);

			expect(written(), status).not.toHaveProperty('application_sent_date');
			expect(result?.appliedDateSet, status).toBeNull();
		}
	});

	it('still dates one the employer turned down, which they could only do once it went out', async () => {
		applicationRow = { ...applicationRow, status_step: 'Preparing', application_sent_date: null };

		await writeApplicationStatus(
			APP,
			PROFILE,
			move({ status: 'rejected', step: null, rounds: [] })
		);

		expect(written()?.application_sent_date).toBe(TODAY);
	});

	it('does not treat still-preparing as sent', async () => {
		applicationRow = { ...applicationRow, status_step: 'Applied', application_sent_date: null };

		await writeApplicationStatus(
			APP,
			PROFILE,
			move({ status: 'applying', step: 'Preparing', rounds: [] })
		);

		expect(written()).not.toHaveProperty('application_sent_date');
	});

	it('rewrites the creation entry when the editor is correcting it', async () => {
		applicationRow = { ...applicationRow, status_step: 'Preparing' };
		logEntries = [{ id: 7, from_status: null }];

		const result = await writeApplicationStatus(
			APP,
			PROFILE,
			move({ status: 'applying', step: 'Applied', rounds: [] }),
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
		applicationRow = { ...applicationRow, status_step: 'Preparing' };
		logEntries = [
			{ id: 7, from_status: null },
			{ id: 8, from_status: 'applying' }
		];

		const result = await writeApplicationStatus(
			APP,
			PROFILE,
			move({ status: 'applying', step: 'Applied', rounds: [] }),
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
	const before = { status: 'applying', step: 'Applied', rounds: [], description: null };

	it('takes back the row its own change added', async () => {
		applicationRow = {
			id: APP,
			status: 'interviewing',
			status_step: null,
			interview_rounds: [technical]
		};
		newestLogRow = [{ id: 88, from_status: 'applying', to_status: 'interviewing' }];

		expect(await revertApplicationStatus(APP, PROFILE, before)).toBe(true);

		expect(written()).toMatchObject({
			status: 'applying',
			status_step: 'Applied',
			interview_rounds: []
		});
		expect(deletes).toEqual(['application_status_log']);
		expect(inserts).toHaveLength(0);
	});

	it('takes back a round added within interviewing', async () => {
		const team = { kind: 'Team', date: null, time: null, with: null };
		applicationRow = {
			id: APP,
			status: 'interviewing',
			status_step: null,
			interview_rounds: [technical, team]
		};
		newestLogRow = [{ id: 90, from_status: 'interviewing', to_status: 'interviewing' }];

		await revertApplicationStatus(APP, PROFILE, {
			status: 'interviewing',
			step: null,
			rounds: [technical],
			description: null
		});

		expect(written()?.interview_rounds).toEqual([technical]);
		expect(deletes).toEqual(['application_status_log']);
	});

	it('puts back a change the timeline never recorded without touching it', async () => {
		// Only who the round was with: that change wrote no row, so the newest row
		// is an earlier move and must survive the undo.
		applicationRow = {
			id: APP,
			status: 'interviewing',
			status_step: null,
			interview_rounds: [{ ...technical, with: 'Anna (CTO)' }]
		};
		newestLogRow = [{ id: 91, from_status: 'applying', to_status: 'interviewing' }];

		await revertApplicationStatus(APP, PROFILE, {
			status: 'interviewing',
			step: null,
			rounds: [technical],
			description: null
		});

		expect(written()?.interview_rounds).toEqual([technical]);
		expect(deletes).toHaveLength(0);
		expect(inserts).toHaveLength(0);
	});

	it('keeps the rounds when the before-image predates them', async () => {
		applicationRow = {
			id: APP,
			status: 'negotiating',
			status_step: 'Offer received',
			interview_rounds: [technical]
		};
		newestLogRow = [{ id: 92, from_status: 'interviewing', to_status: 'negotiating' }];

		await revertApplicationStatus(APP, PROFILE, {
			status: 'interviewing',
			step: 'Technical interview',
			description: null
		});

		expect(written()).toMatchObject({
			status: 'interviewing',
			status_step: null,
			interview_rounds: [technical]
		});
	});

	it('records the move back instead when something else has moved it since', async () => {
		// Deleting here would erase an edit the applicant made by hand. The move
		// back is a real event now, so it is logged as one.
		applicationRow = {
			id: APP,
			status: 'rejected',
			status_step: null,
			interview_rounds: [],
			application_sent_date: '2026-08-01'
		};
		newestLogRow = [{ id: 89, from_status: 'interviewing', to_status: 'rejected' }];

		expect(await revertApplicationStatus(APP, PROFILE, before)).toBe(true);

		expect(deletes).toHaveLength(0);
		expect(logged()).toMatchObject({ from_status: 'rejected', to_status: 'applying' });
	});

	it('never deletes the creation entry', async () => {
		applicationRow = {
			id: APP,
			status: 'applying',
			status_step: 'Preparing',
			interview_rounds: [],
			application_sent_date: null
		};
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

// A tool result shows a model the stored value, and a model repeats what it
// reads. These are what it is shown beside it, so it can say what the applicant
// sees on every page instead.
describe('statusForModel', () => {
	it('names the label beside the value where the two differ', () => {
		expect(statusForModel('rejected')).toBe('rejected (the applicant sees "Not selected")');
		expect(statusForModel('withdrawn')).toBe('withdrawn (the applicant sees "Discontinued")');
		expect(statusForModel('position_closed')).toBe(
			'position_closed (the applicant sees "Position closed")'
		);
		// A legacy value old rows hold reads as the phase it was renamed into.
		expect(statusForModel('sent')).toBe('sent (the applicant sees "Applying")');
	});

	it('leaves a status alone when its label is just the value', () => {
		expect(statusForModel('interviewing')).toBe('interviewing');
	});

	it('lists every status known by another name, for a contract to quote', () => {
		expect(RELABELLED_STATUSES).toBe(
			'rejected reads "Not selected", withdrawn reads "Discontinued" and ' +
				'position_closed reads "Position closed"'
		);
	});
});
