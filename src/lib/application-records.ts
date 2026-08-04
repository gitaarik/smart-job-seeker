/**
 * Record types for the per-application "Activity" stream.
 *
 * A record is any written account of what happened on an application —
 * correspondence, interview rounds, recruiter feedback, an assessment brief, an
 * offer, background research — optionally carrying the file it came from.
 * Keeping those as typed rows (rather than loose notes) is what lets the AI
 * features read prior rounds back as context.
 *
 * ## Why the vocabulary is closed, and small
 *
 * A type earns a slot only if a consumer that CANNOT read the content needs it.
 * The model reads every record on every turn, so any distinction it can
 * re-derive at read time is free and does not need storing. The blind consumers
 * are the only ones that count: TRIM_ORDER (which drops entries before the
 * model sees anything), the pill/filters (a user scanning without opening), and
 * the cross-application comparison spine (aggregate counts).
 *
 * That test is why there is no `email` vs `im` split — once the platform is
 * agreed to be irrelevant, what is left is a register difference the content
 * carries on its face — and no `document` type, which would mean "this one has
 * a file attached", i.e. categorising by input method, which is exactly what
 * the Activity unification exists to remove.
 *
 * See planning/APPLICATION-ACTIVITY.md.
 */

export const recordTypes = [
  {
    value: "message",
    label: "Message",
    hint: "An email, a LinkedIn message, any thread worth keeping",
  },
  {
    value: "interview_recap",
    label: "Interview recap",
    hint: "How a round went, while it's fresh",
  },
  {
    value: "feedback",
    label: "Feedback",
    hint: "What the interviewer or recruiter told you",
  },
  {
    value: "assessment",
    label: "Assessment / assignment",
    hint: "The brief, and how you approached it",
  },
  {
    value: "transcript",
    label: "Transcript",
    hint: "Verbatim notes or a recording transcript",
  },
  {
    value: "offer",
    label: "Offer",
    hint: "What they offered, and the terms",
  },
  {
    value: "contract",
    label: "Contract",
    hint: "The agreement itself",
  },
  {
    value: "research",
    label: "Research",
    hint: "What you dug up about the company or the team",
  },
  {
    // NOT "other". This is the authorship kind — the applicant's own writing —
    // and it is the one distinction here invisible to a content reader, because
    // it only shows up in aggregate: several entries all written by you and
    // nothing received means no employer contact yet on this application.
    //
    // It doubles as the fallback when derivation cannot classify something,
    // which is safe ONLY because that aggregate keys on `contacts` being empty
    // rather than on this type. Anything reading it off the type instead will
    // be subtly wrong.
    value: "note",
    label: "Note / update",
    hint: "Something you jotted down yourself",
  },
] as const;

export type RecordType = (typeof recordTypes)[number]["value"];

export const recordTypeValues: string[] = recordTypes.map((t) => t.value);

export function getRecordTypeLabel(type: string | null): string {
  return recordTypes.find((t) => t.value === type)?.label || "Note / update";
}

/** Tailwind classes per type, mirroring the status-pill treatment elsewhere. */
export const recordTypeColors: Record<string, string> = {
  message: "bg-teal-100 text-teal-700",
  interview_recap: "bg-blue-100 text-blue-700",
  feedback: "bg-amber-100 text-amber-700",
  assessment: "bg-indigo-100 text-indigo-700",
  transcript: "bg-purple-100 text-purple-700",
  offer: "bg-emerald-100 text-emerald-700",
  contract: "bg-green-100 text-green-800",
  research: "bg-slate-100 text-slate-700",
  note: "bg-gray-100 text-gray-700",
};

export function getRecordTypeColor(type: string | null): string {
  return recordTypeColors[type || "note"] || recordTypeColors.note;
}

/**
 * How many entries with content an application needs before its standing
 * summary is worth writing. Below this the entries ARE the summary.
 *
 * Shared rather than duplicated because the summariser and the overview card
 * read it for opposite reasons, and they have to agree: the server skips
 * generation below it, and the card uses it to tell "nothing to condense" apart
 * from "nobody has looked yet". Drifting versions would make the card
 * cheerfully report a gap that is really the rule working.
 */
export const MIN_ENTRIES_FOR_SUMMARY = 2;

/**
 * Who a record involves, stored on `application_records.contacts` as
 * `[{ name, role }]`.
 *
 * jsonb rather than a table because the derivation pass fills it for free and
 * the expensive part of a contacts table is the CRUD UI to manage people;
 * "everyone on this application" is a read-time roll-up over a handful of rows.
 * Promote to `application_contacts` (the name `contacts` is taken — it is
 * user↔user connections for device sharing) as soon as something needs to
 * attach to the *person*: notes, a profile URL, history across applications.
 */
export const contactRoles = [
  { value: "recruiter", label: "Recruiter" },
  { value: "hiring_manager", label: "Hiring manager" },
  { value: "technical_interviewer", label: "Technical interviewer" },
  { value: "hr", label: "HR" },
  { value: "agency", label: "Agency" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
] as const;

export type ContactRole = (typeof contactRoles)[number]["value"];

export const contactRoleValues: string[] = contactRoles.map((r) => r.value);

/** A person involved in a record. Shape of one `contacts` jsonb entry. */
export interface RecordContact {
  name: string;
  role: ContactRole | null;
}

export function getContactRoleLabel(role: string | null): string {
  return contactRoles.find((r) => r.value === role)?.label || "";
}

/** Titles longer than this stop being scannable in a stream. */
const TITLE_MAX = 120;

/**
 * A usable title from an entry's content.
 *
 * The non-LLM fallback: the derivation pass will do better, and until it lands
 * the composer must still never ask for a title. A first line is right
 * surprisingly often — pasted emails lead with a subject, notes lead with their
 * point — which is what makes "no title field" viable before any AI is wired up.
 *
 * Lives here rather than in the route because SvelteKit only permits its own
 * named exports from `+page.server.ts`, and because pure derivation deserves a
 * unit test that does not need a request.
 */
export function deriveRecordTitle(content: string): string {
  const firstLine = content.split("\n").map((l) => l.trim()).find(Boolean) ??
    "";
  // Strip a leading "Subject:" so a pasted email doesn't title itself with it.
  const cleaned = firstLine.replace(/^(subject|onderwerp)\s*:\s*/i, "").trim();
  if (!cleaned) return "Untitled";
  return cleaned.length > TITLE_MAX
    ? cleaned.slice(0, TITLE_MAX).trimEnd() + "…"
    : cleaned;
}
