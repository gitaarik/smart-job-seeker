export const statusOptions = [
  { value: "preparing", label: "Preparing" },
  { value: "sent", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "negotiating", label: "Negotiating" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Not Selected" },
  { value: "withdrawn", label: "Discontinued" },
] as const;

export const statusFilters = [
  { value: "all", label: "All" },
  ...statusOptions,
] as const;

export const statusLabels: Record<string, string> = {
  draft: "Draft",
  preparing: "Preparing",
  sent: "Applied",
  interviewing: "Interviewing",
  negotiating: "Negotiating",
  offered: "Negotiating", // backward compat
  accepted: "Accepted",
  withdrawn: "Discontinued",
  rejected: "Not Selected",
};

export function getStatusLabel(status: string): string {
  return (
    statusLabels[status] ||
    status.charAt(0).toUpperCase() + status.slice(1)
  );
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "draft":
    case "sent":
      return "bg-[var(--dash-info-light)] text-[var(--dash-info)]";
    case "seen":
      return "bg-[var(--dash-purple-light)] text-[var(--dash-purple)]";
    case "preparing":
      return "bg-gray-200 text-gray-700";
    case "interviewing":
      return "bg-[var(--dash-warning-light)] text-[var(--dash-warning)]";
    case "negotiating":
    case "offered":
      return "bg-[var(--dash-success-light)] text-[var(--dash-success)]";
    case "accepted":
      return "bg-green-100 text-green-700";
    case "rejected":
      return "bg-[var(--dash-error-light)] text-[var(--dash-error)]";
    case "withdrawn":
      return "bg-[var(--dash-bg)] text-[var(--dash-text-muted)]";
    default:
      return "bg-[var(--dash-bg)] text-[var(--dash-text-muted)]";
  }
}

export function getStatusDotColor(status: string): string {
  switch (status) {
    case "draft":
    case "sent":
      return "text-[var(--dash-info)]";
    case "preparing":
      return "text-[var(--dash-text-secondary)]";
    case "seen":
      return "text-[var(--dash-purple)]";
    case "interviewing":
      return "text-[var(--dash-warning)]";
    case "negotiating":
    case "offered":
      return "text-[var(--dash-success)]";
    case "accepted":
      return "text-green-700";
    case "rejected":
      return "text-[var(--dash-error)]";
    case "withdrawn":
      return "text-[var(--dash-text-muted)]";
    default:
      return "text-[var(--dash-text-muted)]";
  }
}

export function getStatusBgColor(status: string): string {
  switch (status) {
    case "draft":
    case "sent":
      return "bg-[var(--dash-info)]";
    case "preparing":
      return "bg-[var(--dash-text-secondary)]";
    case "seen":
      return "bg-[var(--dash-purple)]";
    case "interviewing":
      return "bg-[var(--dash-warning)]";
    case "negotiating":
    case "offered":
      return "bg-[var(--dash-success)]";
    case "accepted":
      return "bg-green-600";
    case "rejected":
      return "bg-[var(--dash-error)]";
    case "withdrawn":
      return "bg-[var(--dash-text-muted)]";
    default:
      return "bg-[var(--dash-text-muted)]";
  }
}

export const stepsByPhase: Record<string, string[]> = {
  sent: [
    "Job board message sent",
    "Application form completed",
    "E-mail sent",
    "Resume / CV sent",
  ],
  interviewing: [
    "Screening call",
    "AI interview",
    "Assessment / test",
    "Coding challenge",
    "Take-home assignment",
    "Technical interview",
    "Hiring manager call",
    "Team interview",
  ],
  negotiating: [
    "Offer received",
    "Counter-offer sent",
  ],
};

export const actionsByPhase: Record<string, string[]> = {
  preparing: [
    "Send application",
    "Tailor Resume/CV",
    "Write cover letter",
    "Complete platform profile",
  ],
  sent: [
    "Awaiting response",
  ],
  interviewing: [
    "Need to schedule",
    "Scheduled",
    "Need to complete",
    "Provide references",
    "Awaiting result",
  ],
  negotiating: [
    "Respond",
    "Provide references",
    "Awaiting response",
  ],
};

export const defaultStepByPhase: Record<string, string> = {
  sent: "Job board message sent",
  interviewing: "Screening call",
  negotiating: "Offer received",
};

export const defaultActionByPhase: Record<string, string> = {
  preparing: "Send application",
  sent: "Awaiting response",
  negotiating: "Respond",
};

// Step-specific default actions (overrides phase default when a step is selected)
export const defaultActionByStep: Record<string, string> = {
  "Screening call": "Scheduled",
  "Technical interview": "Need to schedule",
  "Hiring manager call": "Need to schedule",
  "Team interview": "Need to schedule",
  "Coding challenge": "Need to complete",
  "Take-home assignment": "Need to complete",
  "Assessment / test": "Need to complete",
  "AI interview": "Need to complete",
  "Offer received": "Respond",
  "Counter-offer sent": "Awaiting response",
};
