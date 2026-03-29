import {
  JOB_TYPES,
  WORK_LOCATIONS,
  EXPERIENCE_LEVELS,
  buildDisplayMap,
  matchPatternDisplay,
} from "$lib/data/job-taxonomy";

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

function titleCase(str: string): string {
  return str
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
