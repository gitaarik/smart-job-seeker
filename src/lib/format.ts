import {
  JOB_TYPES,
  WORK_LOCATIONS,
  EXPERIENCE_LEVELS,
  buildDisplayMap,
  matchPatternDisplay,
} from "$lib/data/job-taxonomy";
import { formatSalaryPeriod } from "$lib/salary/conversion";

const jobTypeLabels = buildDisplayMap(JOB_TYPES);
const workLocationLabels = buildDisplayMap(WORK_LOCATIONS);
const experienceLevelLabels = buildDisplayMap(EXPERIENCE_LEVELS);

const JOB_STATUS_LABELS: Record<string, string> = {
  hiring: "Hiring",
  closed: "Closed",
  stale: "Stale",
  published: "Published",
  draft: "Draft",
};

export function formatJobType(type: string): string {
  return jobTypeLabels.get(type.toLowerCase()) ?? titleCase(type);
}

export function formatJobStatus(status: string): string {
  return JOB_STATUS_LABELS[status.toLowerCase()] ?? titleCase(status);
}

export function formatWorkLocation(location: string): string {
  const lower = location.toLowerCase();
  const exact = workLocationLabels.get(lower);
  if (exact) return exact;
  // Handle prefix/substring patterns like "Hybrid (up to 3 remote days p/w)" or "Remote in UK"
  return matchPatternDisplay(WORK_LOCATIONS, lower) ?? titleCase(location);
}

export function formatExperienceLevel(level: string): string {
  return experienceLevelLabels.get(level.toLowerCase()) ?? titleCase(level);
}

/**
 * Build a display name for a search task: platform name is primary, note is optional secondary.
 */
export function searchTaskDisplayName(
  platformName: string | null | undefined,
  note: string | null | undefined,
): string {
  const base = platformName || "Search task";
  return note ? `${base} — ${note}` : base;
}

/**
 * Format a salary range, handling min===max as a single value.
 * Used on job detail pages, job cards, and application pages.
 */
export function formatSalaryRange(
  min: number | null,
  max: number | null,
  currency: string | null,
  period: string | null,
): string {
  if (!min && !max) return "Not specified";
  const curr = currency || "USD";
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: curr,
    maximumFractionDigits: 0,
  });
  let result = "";
  if (min && max && min === max) {
    result = formatter.format(min);
  } else if (min && max) {
    result = `${formatter.format(min)} – ${formatter.format(max)}`;
  } else if (min) {
    result = `From ${formatter.format(min)}`;
  } else if (max) {
    result = `Up to ${formatter.format(max)}`;
  }
  const label = formatSalaryPeriod(period);
  if (label) {
    result += ` / ${label}`;
  }
  return result;
}

/**
 * Returns true when min and max are the same (single value, not a range).
 */
export function isSalarySingleValue(
  min: number | null,
  max: number | null,
): boolean {
  return min != null && max != null && min === max;
}

/**
 * Format a date as relative time (e.g., "2 days ago", "3 weeks ago").
 */
export function timeAgo(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return "1 week ago";
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 month ago";
  if (diffMonths < 12) return `${diffMonths} months ago`;
  const diffYears = Math.floor(diffDays / 365);
  if (diffYears === 1) return "1 year ago";
  return `${diffYears} years ago`;
}

function titleCase(str: string): string {
  return str
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
