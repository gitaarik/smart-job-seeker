import { describe, expect, it } from 'vitest';
import { nextSlotAtHour, zonedHourToUtc } from '../zoned-hour';

describe('zonedHourToUtc', () => {
	it('reads a plain winter and summer hour', () => {
		expect(zonedHourToUtc(2026, 1, 15, 9, 'Europe/Amsterdam').toISOString()).toBe(
			'2026-01-15T08:00:00.000Z'
		);
		expect(zonedHourToUtc(2026, 7, 15, 9, 'Europe/Amsterdam').toISOString()).toBe(
			'2026-07-15T07:00:00.000Z'
		);
		expect(zonedHourToUtc(2026, 1, 15, 9, 'Asia/Kolkata').toISOString()).toBe(
			'2026-01-15T03:30:00.000Z'
		);
	});

	it('uses the new offset for a morning hour on a US changeover day', () => {
		// Clocks go forward at 02:00 on 2026-03-08 and back at 02:00 on 2026-11-01.
		expect(zonedHourToUtc(2026, 3, 8, 3, 'America/New_York').toISOString()).toBe(
			'2026-03-08T07:00:00.000Z'
		);
		expect(zonedHourToUtc(2026, 3, 8, 6, 'America/Los_Angeles').toISOString()).toBe(
			'2026-03-08T13:00:00.000Z'
		);
		expect(zonedHourToUtc(2026, 11, 1, 3, 'America/New_York').toISOString()).toBe(
			'2026-11-01T08:00:00.000Z'
		);
	});

	it('uses the old offset for an hour before a European change', () => {
		// Clocks go forward at 01:00 UTC on 2026-03-29, back at 01:00 UTC on 2026-10-25.
		expect(zonedHourToUtc(2026, 3, 29, 1, 'Europe/Amsterdam').toISOString()).toBe(
			'2026-03-29T00:00:00.000Z'
		);
		expect(zonedHourToUtc(2026, 10, 25, 1, 'Europe/Amsterdam').toISOString()).toBe(
			'2026-10-24T23:00:00.000Z'
		);
	});

	it('resolves a skipped hour an hour on and a repeated hour to one of its passes', () => {
		expect(zonedHourToUtc(2026, 3, 29, 2, 'Europe/Amsterdam').toISOString()).toBe(
			'2026-03-29T01:00:00.000Z'
		);
		expect(zonedHourToUtc(2026, 10, 25, 2, 'Europe/Amsterdam').toISOString()).toBe(
			'2026-10-25T01:00:00.000Z'
		);
	});
});

describe('nextSlotAtHour', () => {
	const now = new Date('2026-01-15T12:00:00Z'); // 13:00 in Amsterdam

	it('is today when the hour is ahead and tomorrow when it has passed', () => {
		expect(nextSlotAtHour(18, 'Europe/Amsterdam', 0, now).toISOString()).toBe(
			'2026-01-15T17:00:00.000Z'
		);
		expect(nextSlotAtHour(9, 'Europe/Amsterdam', 0, now).toISOString()).toBe(
			'2026-01-16T08:00:00.000Z'
		);
	});

	it('counts the current hour as passed', () => {
		expect(nextSlotAtHour(13, 'Europe/Amsterdam', 0, now).toISOString()).toBe(
			'2026-01-16T12:00:00.000Z'
		);
	});

	it('adds whole days and rolls over a month end', () => {
		expect(
			nextSlotAtHour(9, 'Europe/Amsterdam', 6, new Date('2026-01-28T12:00:00Z')).toISOString()
		).toBe('2026-02-04T08:00:00.000Z');
	});

	it('keeps the local hour across a clock change', () => {
		// The evening before the US change: tomorrow 06:00 is 13:00 UTC, not 14:00.
		expect(
			nextSlotAtHour(6, 'America/Los_Angeles', 0, new Date('2026-03-08T04:00:00Z')).toISOString()
		).toBe('2026-03-08T13:00:00.000Z');
	});
});
