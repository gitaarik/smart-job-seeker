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
  hybrid: "Hybrid",
  onsite: "On-site",
  "on-site": "On-site",
  "on_site": "On-site",
};

export function formatJobType(type: string): string {
  return JOB_TYPE_LABELS[type.toLowerCase()] ?? titleCase(type);
}

export function formatJobStatus(status: string): string {
  return JOB_STATUS_LABELS[status.toLowerCase()] ?? titleCase(status);
}

export function formatWorkLocation(location: string): string {
  return WORK_LOCATION_LABELS[location.toLowerCase()] ?? titleCase(location);
}

function titleCase(str: string): string {
  return str
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
