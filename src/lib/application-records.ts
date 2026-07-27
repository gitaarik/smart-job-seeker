/**
 * Record types for the per-application "Interviews" tab.
 *
 * The tab is named for its dominant use — interview rounds — but it is the home
 * for any written account of what happened on an application: recruiter
 * feedback, a pasted email thread, an assessment brief, background research.
 * Keeping those as typed rows (rather than loose notes) is what lets the AI
 * features read prior rounds back as context.
 */

export const recordTypes = [
  {
    value: "interview_recap",
    label: "Interview recap",
    hint: "How a round went, while it's fresh",
  },
  {
    value: "transcript",
    label: "Transcript",
    hint: "Verbatim notes or a recording transcript",
  },
  {
    value: "feedback",
    label: "Feedback",
    hint: "What the interviewer or recruiter told you",
  },
  {
    value: "email",
    label: "Email / message",
    hint: "A pasted thread worth keeping",
  },
  {
    value: "assessment",
    label: "Assessment / assignment",
    hint: "The brief, and how you approached it",
  },
  {
    value: "research",
    label: "Research",
    hint: "What you dug up about the company or the team",
  },
  { value: "note", label: "Other", hint: "Anything else worth recording" },
] as const;

export type RecordType = (typeof recordTypes)[number]["value"];

export const recordTypeValues: string[] = recordTypes.map((t) => t.value);

export function getRecordTypeLabel(type: string | null): string {
  return recordTypes.find((t) => t.value === type)?.label || "Other";
}

/** Tailwind classes per type, mirroring the status-pill treatment elsewhere. */
export const recordTypeColors: Record<string, string> = {
  interview_recap: "bg-blue-100 text-blue-700",
  transcript: "bg-purple-100 text-purple-700",
  feedback: "bg-amber-100 text-amber-700",
  email: "bg-teal-100 text-teal-700",
  assessment: "bg-indigo-100 text-indigo-700",
  research: "bg-slate-100 text-slate-700",
  note: "bg-gray-100 text-gray-700",
};

export function getRecordTypeColor(type: string | null): string {
  return recordTypeColors[type || "note"] || recordTypeColors.note;
}
