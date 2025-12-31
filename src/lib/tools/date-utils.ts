import {
  subDays,
  subHours,
  subMinutes,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";

/**
 * Parse relative date strings into actual Date objects
 * Handles expressions like "3 days ago", "2 weeks ago", "posted yesterday"
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
  const cleaned = strValue.toLowerCase().trim();

  // Try absolute date first (ISO, standard formats)
  const absoluteDate = new Date(strValue);
  if (!isNaN(absoluteDate.getTime())) {
    // Check if it looks like a relative expression before accepting
    if (
      !cleaned.includes("ago") &&
      !cleaned.includes("yesterday") &&
      !cleaned.includes("today")
    ) {
      return absoluteDate;
    }
  }

  // Pattern: "X days/weeks/months/years/hours/minutes ago"
  const relativeMatch = cleaned.match(
    /(\d+)\s*(day|week|month|year|hour|minute)s?\s*ago/,
  );
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];

    switch (unit) {
      case "minute":
        return subMinutes(referenceDate, amount);
      case "hour":
        return subHours(referenceDate, amount);
      case "day":
        return subDays(referenceDate, amount);
      case "week":
        return subWeeks(referenceDate, amount);
      case "month":
        return subMonths(referenceDate, amount);
      case "year":
        return subYears(referenceDate, amount);
    }
  }

  // Abbreviated patterns: "3d ago", "2w ago", "1mo ago"
  const shortMatch = cleaned.match(/(\d+)\s*([dwmy]|mo)\s*ago/);
  if (shortMatch) {
    const amount = parseInt(shortMatch[1], 10);
    const unit = shortMatch[2];

    switch (unit) {
      case "d":
        return subDays(referenceDate, amount);
      case "w":
        return subWeeks(referenceDate, amount);
      case "mo":
      case "m":
        return subMonths(referenceDate, amount);
      case "y":
        return subYears(referenceDate, amount);
    }
  }

  // Named relative dates
  if (cleaned.includes("today")) {
    const today = new Date(referenceDate);
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }
  if (cleaned.includes("yesterday")) {
    const yesterday = subDays(referenceDate, 1);
    yesterday.setUTCHours(0, 0, 0, 0);
    return yesterday;
  }
  if (cleaned.includes("last week")) {
    return subWeeks(referenceDate, 1);
  }
  if (cleaned.includes("last month")) {
    return subMonths(referenceDate, 1);
  }

  // If we got here and the absolute date was valid, return it
  if (!isNaN(absoluteDate.getTime())) {
    return absoluteDate;
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
