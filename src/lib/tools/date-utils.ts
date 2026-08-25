import * as chrono from 'chrono-node';

/**
 * Coerce a date-ish value to YYYY-MM-DD for Drizzle `date()` columns
 * (which use string mode). Returns null for null/undefined/invalid input.
 */
export function toDateString(value: string | Date | null | undefined): string | null {
	if (value == null) return null;
	const d = typeof value === 'string' ? new Date(value) : value;
	if (isNaN(d.getTime())) return null;
	return d.toISOString().split('T')[0];
}

/**
 * Parse relative date strings into actual Date objects
 * Handles expressions like "3 days ago", "a month ago", "posted yesterday", "submitted two weeks ago"
 * Uses Chrono library for natural language date parsing
 * @param dateString - Raw date string from job posting
 * @param referenceDate - Reference date (typically scrape time), defaults to now
 * @returns Parsed Date object or null if invalid/unparseable
 */
export function parseRelativeDate(
	dateString: string | null | undefined | Date,
	referenceDate: Date = new Date()
): Date | null {
	if (!dateString) return null;

	// Handle Date objects directly
	if (dateString instanceof Date) {
		return dateString;
	}

	// Convert to string if not already
	const strValue = String(dateString);

	// Use Chrono to parse the date string
	// Chrono handles many natural language formats:
	// - "a month ago", "2 days ago", "three weeks ago"
	// - "posted yesterday", "submitted last week"
	// - "publicized 5 hours ago"
	// - Absolute dates like "2024-01-15" or "Jan 15, 2024"
	const parsed = chrono.parseDate(strValue, referenceDate, {
		forwardDate: false // Don't interpret ambiguous dates as future dates
	});

	if (parsed && !isNaN(parsed.getTime())) {
		return parsed;
	}

	// Unparseable
	return null;
}

/**
 * Validate that a date is reasonable for a job posting
 * Rejects future dates, dates before 2000, and invalid Date objects
 * @param date - Date to validate
 * @param options - Validation options
 * @returns true if valid, false otherwise
 */
export function isValidJobPostingDate(
	date: Date | null,
	options: {
		minYear?: number;
		allowFuture?: boolean;
	} = {}
): boolean {
	// Reject null or Invalid Date objects
	if (!date || isNaN(date.getTime())) {
		return false;
	}

	// Reject dates before minimum year (default: 2000)
	const minYear = options.minYear ?? 2000;
	if (date.getFullYear() < minYear) {
		return false;
	}

	// Reject future dates (default behavior)
	const allowFuture = options.allowFuture ?? false;
	if (!allowFuture && date > new Date()) {
		return false;
	}

	return true;
}

/** Coerce a Date or date string (e.g. "2024-01-15") into a Date object. */
function toDate(value: Date | string): Date {
	return value instanceof Date ? value : new Date(value);
}

export function formatDateRangeVerbose(
	startDate: Date | string | null,
	endDate?: Date | string | null
): string {
	const formatDate = (date: Date | string) => {
		const d = toDate(date);
		const year = d.getFullYear();
		const month = d.getMonth();
		const monthNames = [
			'Jan',
			'Feb',
			'Mar',
			'Apr',
			'May',
			'Jun',
			'Jul',
			'Aug',
			'Sep',
			'Oct',
			'Nov',
			'Dec'
		];
		return `${monthNames[month]} ${year}`;
	};

	if (!startDate) return '';
	const start = formatDate(startDate);
	const end = endDate ? formatDate(endDate) : 'Present';
	return `${start} - ${end}`;
}

export function formatDateRangeCompact(
	startDate: Date | string | null,
	endDate?: Date | string | null,
	/** Label for an ongoing role; localized by the caller (default English). */
	presentLabel = 'Present'
): string {
	const formatDate = (date: Date | string) => {
		const d = toDate(date);
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const year = d.getFullYear();
		return `${month}/${year}`;
	};

	if (!startDate) return '';
	const start = formatDate(startDate);
	const end = endDate ? formatDate(endDate) : presentLabel;
	// Started and ended in the same month is one date, not a range:
	// "01/2014", not "01/2014 - 01/2014".
	return start === end ? start : `${start} - ${end}`;
}

export function formatDateRangeYear(
	startDate: Date | string | null,
	endDate?: Date | string | null
): string {
	if (!startDate) return '';
	const startYear = toDate(startDate).getFullYear();
	const endYear = endDate ? toDate(endDate).getFullYear() : 'Present';

	return `${startYear} - ${endYear}`;
}
