import * as chrono from "chrono-node";

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
  referenceDate: Date = new Date(),
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
    forwardDate: false, // Don't interpret ambiguous dates as future dates
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
  } = {},
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

export function formatDateRangeVerbose(
  startDate: Date | null,
  endDate?: Date | null,
): string {
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${monthNames[month]} ${year}`;
  };

  if (!startDate) return "";
  const start = formatDate(startDate);
  const end = endDate ? formatDate(endDate) : "Present";
  return `${start} - ${end}`;
}

export function formatDateRangeCompact(
  startDate: Date | null,
  endDate?: Date | null,
): string {
  const formatDate = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}/${year}`;
  };

  if (!startDate) return "";
  const start = formatDate(startDate);
  const end = endDate ? formatDate(endDate) : "Present";
  return `${start} - ${end}`;
}

export function formatDateRangeYear(
  startDate: Date | null,
  endDate?: Date | null,
): string {
  if (!startDate) return "";
  const startYear = startDate.getFullYear();
  const endYear = endDate ? endDate.getFullYear() : "Present";

  return `${startYear} - ${endYear}`;
}
