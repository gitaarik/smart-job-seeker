const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  fulltime: "Full-time",
  "full-time": "Full-time",
  part_time: "Part-time",
  parttime: "Part-time",
  "part-time": "Part-time",
  contract: "Contract",
  contractor: "Contractor",
  freelance: "Freelance",
  permanent: "Permanent",
  "temp-to-hire": "Temp to Hire",
  internship: "Internship",
};

const JOB_STATUS_LABELS: Record<string, string> = {
  hiring: "Hiring",
  closed: "Closed",
  stale: "Stale",
  published: "Published",
  draft: "Draft",
};

const WORK_LOCATION_LABELS: Record<string, string> = {
  remote: "Remote",
  "fully remote": "Remote",
  "remote (no onsite)": "Remote",
  hybrid: "Hybrid",
  hybride: "Hybrid",
  onsite: "On-site",
  "on-site": "On-site",
  "on_site": "On-site",
  // Dutch
  "in overleg": "Hybrid",
  // English
  flexible: "Hybrid",
  negotiable: "Hybrid",
  "by agreement": "Hybrid",
  "by mutual agreement": "Hybrid",
  "by arrangement": "Hybrid",
  // German
  "nach absprache": "Hybrid",
  "nach vereinbarung": "Hybrid",
  flexibel: "Hybrid",
  "vor ort": "On-site",
  // French
  "en concertation": "Hybrid",
  "selon accord": "Hybrid",
  "à convenir": "Hybrid",
  "à définir": "Hybrid",
  "en accord": "Hybrid",
  "sur site": "On-site",
  "sur place": "On-site",
  // Spanish
  "a convenir": "Hybrid",
  "según acuerdo": "Hybrid",
  negociable: "Hybrid",
  // Portuguese
  "a combinar": "Hybrid",
  "a negociar": "Hybrid",
};

export function formatJobType(type: string): string {
  return JOB_TYPE_LABELS[type.toLowerCase()] ?? titleCase(type);
}

export function formatJobStatus(status: string): string {
  return JOB_STATUS_LABELS[status.toLowerCase()] ?? titleCase(status);
}

export function formatWorkLocation(location: string): string {
  const lower = location.toLowerCase();
  if (WORK_LOCATION_LABELS[lower]) return WORK_LOCATION_LABELS[lower];
  // Handle prefix patterns like "Hybrid (up to 3 remote days p/w)" or "Remote in UK"
  if (lower.startsWith("hybrid")) return "Hybrid";
  if (lower.startsWith("remote")) return "Remote";
  return titleCase(location);
}

const EXPERIENCE_LEVEL_LABELS: Record<string, string> = {
  entry: "Entry Level",
  entry_level: "Entry Level",
  "entry-level": "Entry Level",
  junior: "Junior",
  mid: "Mid Level",
  mid_level: "Mid Level",
  "mid-level": "Mid Level",
  mid_senior: "Mid-Senior",
  "mid-senior": "Mid-Senior",
  senior: "Senior",
  lead: "Lead",
  principal: "Principal",
  staff: "Staff",
  director: "Director",
  executive: "Executive",
  internship: "Internship",
};

export function formatExperienceLevel(level: string): string {
  return EXPERIENCE_LEVEL_LABELS[level.toLowerCase()] ?? titleCase(level);
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
