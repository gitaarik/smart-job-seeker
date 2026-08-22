/**
 * The whole feature is one date comparison, so the cases that matter are the
 * boundary (the day it comes back) and the ways a date can be wrong.
 */
import { describe, expect, it } from 'vitest';
import {
	daysUntil,
	describeSnooze,
	isSnoozed,
	snoozeError,
	snoozeUntil
} from './application-snooze';

const TODAY = '2026-08-22';

describe('isSnoozed', () => {
	it('is false when nothing was ever set', () => {
		expect(isSnoozed({}, TODAY)).toBe(false);
		expect(isSnoozed({ snoozed_until: null }, TODAY)).toBe(false);
	});

	it('is true while the return day is still ahead', () => {
		expect(isSnoozed({ snoozed_until: '2026-08-23' }, TODAY)).toBe(true);
		expect(isSnoozed({ snoozed_until: '2026-12-01' }, TODAY)).toBe(true);
	});

	// The elapsed snooze is deliberately left in the column rather than cleared
	// by a job, so "comes back on its own" is exactly this boundary.
	it('has elapsed on the day it names', () => {
		expect(isSnoozed({ snoozed_until: TODAY }, TODAY)).toBe(false);
	});

	it('has elapsed once the day is past', () => {
		expect(isSnoozed({ snoozed_until: '2026-08-01' }, TODAY)).toBe(false);
	});

	// A year boundary is where a comparison done on day-of-month rather than the
	// whole string would go wrong.
	it('compares whole dates, not day numbers', () => {
		expect(isSnoozed({ snoozed_until: '2027-01-02' }, '2026-12-30')).toBe(true);
		expect(isSnoozed({ snoozed_until: '2026-12-30' }, '2027-01-02')).toBe(false);
	});
});

describe('daysUntil', () => {
	it('counts whole days forward', () => {
		expect(daysUntil('2026-08-29', TODAY)).toBe(7);
	});

	it('goes negative for a date already past', () => {
		expect(daysUntil('2026-08-20', TODAY)).toBe(-2);
	});

	it('crosses a month end', () => {
		expect(daysUntil('2026-09-01', '2026-08-31')).toBe(1);
	});

	// A DST change is an hour, and a naive (ms diff / 86.4e6) floor turns that
	// into an off-by-one. Parsing as UTC is what keeps this exact.
	it('is unaffected by a daylight-saving boundary', () => {
		expect(daysUntil('2026-10-26', '2026-10-25')).toBe(1);
		expect(daysUntil('2026-03-30', '2026-03-29')).toBe(1);
	});

	it('returns null for a date it cannot read', () => {
		expect(daysUntil('next tuesday', TODAY)).toBeNull();
	});
});

describe('snoozeUntil', () => {
	it('adds days', () => {
		expect(snoozeUntil(7, TODAY)).toBe('2026-08-29');
		expect(snoozeUntil(90, TODAY)).toBe('2026-11-20');
	});

	it('rolls over a year end', () => {
		expect(snoozeUntil(30, '2026-12-20')).toBe('2027-01-19');
	});

	it('handles a leap day', () => {
		expect(snoozeUntil(1, '2028-02-28')).toBe('2028-02-29');
	});
});

describe('snoozeError', () => {
	it('accepts a future date', () => {
		expect(snoozeError('2026-09-01', TODAY)).toBeNull();
	});

	it('refuses a missing or unparseable date', () => {
		expect(snoozeError('', TODAY)).toMatch(/YYYY-MM-DD/);
		expect(snoozeError(null, TODAY)).toMatch(/YYYY-MM-DD/);
		expect(snoozeError('01-09-2026', TODAY)).toMatch(/YYYY-MM-DD/);
	});

	// Date.UTC would roll this into March rather than reject it.
	it('refuses a day that does not exist', () => {
		expect(snoozeError('2026-02-31', TODAY)).toMatch(/YYYY-MM-DD/);
	});

	// A past date and no snooze at all look identical afterwards, so this one is
	// worth a message rather than a silent no-op.
	it('refuses today and anything before it', () => {
		expect(snoozeError(TODAY, TODAY)).toMatch(/future/);
		expect(snoozeError('2026-01-01', TODAY)).toMatch(/future/);
	});

	it('refuses a date far enough out to be a typo', () => {
		expect(snoozeError('2126-08-22', TODAY)).toMatch(/five years/);
	});
});

describe('describeSnooze', () => {
	it('phrases the near cases exactly', () => {
		expect(describeSnooze('2026-08-23', TODAY)).toBe('back tomorrow');
		expect(describeSnooze('2026-08-28', TODAY)).toBe('back in 6 days');
	});

	it('rounds the far ones', () => {
		expect(describeSnooze('2026-09-05', TODAY)).toBe('back in 2 weeks');
		expect(describeSnooze('2026-11-20', TODAY)).toBe('back in 3 months');
	});

	it('says so when it has already elapsed', () => {
		expect(describeSnooze(TODAY, TODAY)).toBe('back now');
		expect(describeSnooze('2026-08-01', TODAY)).toBe('back now');
	});
});
