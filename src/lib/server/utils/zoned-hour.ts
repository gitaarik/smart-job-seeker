/**
 * "This hour on that day, in that timezone" as an absolute instant, and the
 * next slot at an hour. Pure apart from the default `now`, so the task editor
 * (oss) and the scheduler (cloud worker) share one calculation.
 */

/** How far the zone's wall clock is ahead of UTC at `instant`, in ms. */
function offsetAt(instant: number, timezone: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(new Date(instant));
	const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
	const wall = Date.UTC(
		get('year'),
		get('month') - 1,
		get('day'),
		get('hour'),
		get('minute'),
		get('second')
	);
	return wall - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant at which the zone's clock reads `hour`:00 on the given date.
 *
 * The offset is read at the answer, not at "that hour in UTC". The two differ
 * on the day the clocks change: 03:00 UTC on a US changeover day is still
 * before the change while 03:00 in New York is after it, which used to put
 * that day's run an hour off. An hour the change skips resolves to the
 * instant an hour later, and a repeated hour to one of its two passes.
 */
export function zonedHourToUtc(
	year: number,
	month: number,
	day: number,
	hour: number,
	timezone: string
): Date {
	const wall = Date.UTC(year, month - 1, day, hour);
	const first = wall - offsetAt(wall, timezone);
	const second = wall - offsetAt(first, timezone);
	if (second === first) return new Date(first);
	// The guess crossed a change. Keep the candidate that reads back as the
	// asked wall time; in a skipped hour neither does, and the earlier offset
	// (the later instant) is the clock's own answer.
	if (second + offsetAt(second, timezone) === wall) return new Date(second);
	if (first + offsetAt(first, timezone) === wall) return new Date(first);
	return new Date(Math.max(first, second));
}

/**
 * The first slot at `hour`:00 in the zone that is still ahead of `now`, moved
 * `extraDays` calendar days on. A slot at exactly `now` counts as passed.
 */
export function nextSlotAtHour(
	hour: number,
	timezone: string,
	extraDays = 0,
	now: Date = new Date()
): Date {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(now);
	const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
	const slotOnDay = (daysFromToday: number): Date => {
		// Calendar arithmetic in UTC, so a month or year end rolls over.
		const day = new Date(Date.UTC(get('year'), get('month') - 1, get('day') + daysFromToday));
		return zonedHourToUtc(
			day.getUTCFullYear(),
			day.getUTCMonth() + 1,
			day.getUTCDate(),
			hour,
			timezone
		);
	};
	const firstAhead = slotOnDay(0).getTime() > now.getTime() ? 0 : 1;
	return slotOnDay(firstAhead + extraDays);
}
