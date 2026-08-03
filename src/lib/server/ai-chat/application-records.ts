/**
 * Render an application's interview records as prompt context.
 *
 * The point of storing recaps, feedback and transcripts as text is that later
 * work can build on them — a cheat sheet for round 3 should know what round 2
 * pushed on, and a follow-up note should not re-introduce the applicant to
 * someone they already spoke to.
 *
 * ## Why caps rather than retrieval
 *
 * Writing prompts run on the writing provider (Gemini 2.5 Pro, 1M context)
 * falling back to gpt-oss-120b (131k). A dozen capped records is ~24k tokens
 * worst case, so the whole set fits and can be handed over verbatim.
 *
 * Chunk retrieval would also be actively worse here: the value of these
 * records is sequential ("round 2 pushed on caching"), and top-k similarity
 * returns fragments out of order. Retrieval earns its keep over hundreds of
 * documents, not a dozen. If this ever does overflow, the right escalation is
 * summarising older records — which preserves order — not retrieving over them.
 */

import { db } from "$lib/server/db";
import { asc, eq } from "drizzle-orm";
import { application_records } from "$lib/server/db/schema";
import { getRecordTypeLabel } from "$lib/application-records";

/**
 * `full` is for prompts that are *about* the interviews (cheat sheets), where
 * the records are the subject. `compact` is for writing prompts (letters,
 * application answers), which need the gist rather than the transcript.
 */
export type RecordsContextMode = "compact" | "full";

const BUDGETS: Record<
  RecordsContextMode,
  { perRecord: number; total: number; maxRecords: number }
> = {
  full: { perRecord: 4000, total: 40000, maxRecords: 12 },
  compact: { perRecord: 1500, total: 12000, maxRecords: 8 },
};

/**
 * Order records are sacrificed in when over budget — lowest signal-per-token
 * first. A raw transcript is the least efficient way to tell a writer what
 * happened; a recap or a piece of feedback is the most, and an offer or a
 * signed contract is the last thing that should ever be dropped.
 *
 * ⚠️ This must list EVERY value in `recordTypes`. `trimRank` returns 0 for
 * anything unlisted, and 0 means *sacrificed first* — so a type added to the
 * vocabulary and forgotten here silently becomes the cheapest thing in the
 * budget rather than the most expensive. Exported so that invariant is a test
 * rather than a comment.
 */
export const TRIM_ORDER = [
  "transcript",
  "note",
  "research",
  "message",
  "assessment",
  "feedback",
  "interview_recap",
  "offer",
  "contract",
];

function trimRank(recordType: string | null): number {
  const i = TRIM_ORDER.indexOf(recordType || "note");
  return i === -1 ? 0 : i;
}

/** The shape this module needs — kept narrow so tests need no DB row. */
export interface RecordForContext {
  record_type: string | null;
  title: string | null;
  content: string | null;
  step: string | null;
  event_date: string | null;
}

/**
 * Truncate keeping BOTH ends. The close of an interview holds the next steps
 * and the parting feedback, which head-only truncation would discard — often
 * the single most useful line in the record.
 */
export function truncateKeepingEnds(text: string, max: number): string {
  if (text.length <= max) return text;
  const marker = "\n\n[…middle omitted…]\n\n";
  const budget = max - marker.length;
  if (budget <= 0) return text.slice(0, max);
  const head = Math.floor(budget * 0.6);
  const tail = budget - head;
  return `${text.slice(0, head).trimEnd()}${marker}${
    text.slice(text.length - tail).trimStart()
  }`;
}

function renderBlock(record: RecordForContext, perRecord: number): string {
  const heading = [
    `### ${getRecordTypeLabel(record.record_type)}: ${
      record.title?.trim() || "Untitled"
    }`,
    record.step ? `Stage: ${record.step}` : null,
    record.event_date ? `Date: ${record.event_date}` : null,
  ].filter(Boolean).join("\n");

  return `${heading}\n\n${
    truncateKeepingEnds(record.content!.trim(), perRecord)
  }`;
}

/**
 * Format records into a prompt block, applying the per-record and total caps.
 * Pure — no DB access — so the budget behaviour is directly testable.
 */
export function formatRecordsContext(
  records: RecordForContext[],
  mode: RecordsContextMode = "full",
): string {
  const budget = BUDGETS[mode];
  const withContent = records.filter((r) => r.content?.trim());
  if (withContent.length === 0) return "";

  // Records arrive oldest-first. Drop lowest-value types first and, within a
  // type, the oldest — so what survives is the most recent and most useful.
  const kept = [...withContent];
  const dropOrder = withContent
    .map((record, index) => ({ record, index }))
    .sort((a, b) =>
      trimRank(a.record.record_type) - trimRank(b.record.record_type) ||
      a.index - b.index
    );

  let dropped = 0;
  const size = () =>
    kept.reduce((sum, r) => sum + renderBlock(r, budget.perRecord).length, 0);

  for (const { record } of dropOrder) {
    if (kept.length <= budget.maxRecords && size() <= budget.total) break;
    // Never drop the last one — a truncated record beats no context at all.
    if (kept.length === 1) break;
    kept.splice(kept.indexOf(record), 1);
    dropped++;
  }

  // Two audiences, two different risks. Outward-facing text (letters, answers)
  // can invent a shared history that never happened, so its guidance separates
  // *what was learned* from *the fact that it was learned in a conversation* —
  // which is a sharper fabrication guard than "use them only where they help",
  // and simultaneously stops the records being skimmed as optional colour.
  // Cheat sheets are private prep notes: referencing the conversation is the
  // whole point, so there the pressure is all on acting rather than nodding.
  const guidance = mode === "compact"
    ? [
      "These are the applicant's own records of what has happened on this",
      "application so far. Treat them as the most reliable information you",
      "have about this employer and this role: where they contradict the job",
      "posting or an assumption the applicant made earlier, the records win,",
      "and the corrected version is the one to use.",
      "",
      "They do NOT license you to reference the interaction itself.",
      "Never imply a conversation, meeting or relationship that is not",
      "recorded below — the text you are writing may well predate all of it.",
      "Use what was learned, not the fact that it was learned.",
      "",
      "The records may be written in a different language than the text you",
      "are producing. Translate what you use; never drop a point because of",
      "the language it happens to be written in.",
    ]
    : [
      "These are the applicant's own records of earlier rounds, feedback and",
      "correspondence. They are the most important input you have: act on",
      "them, do not merely acknowledge them. Build on what was already",
      "discussed, address the concerns that were raised, and",
      "do not re-prepare ground already covered.",
      "",
      "Where the records correct something the applicant got wrong, or",
      "recommend specific preparation, that correction and that",
      "recommendation are the point — surface them explicitly rather than",
      "quietly working around them.",
      "",
      "The records may be written in a different language than the text you",
      "are producing. Translate what you use; never drop a point because of",
      "the language it happens to be written in.",
    ];

  const omission = dropped > 0
    ? [
      "",
      `NOTE: ${dropped} further record(s) exist but were omitted to fit. Treat`,
      "the picture below as partial rather than complete.",
    ]
    : [];

  return [
    "## What has already happened in this application",
    "",
    ...guidance,
    ...omission,
    "",
    kept.map((r) => renderBlock(r, budget.perRecord)).join("\n\n---\n\n"),
  ].join("\n");
}

/**
 * Load an application's records and render them as prompt context.
 * Returns "" when there is nothing recorded — callers interpolate it blindly.
 */
export async function interviewRecordsText(
  applicationId: number,
  mode: RecordsContextMode = "full",
): Promise<string> {
  try {
    const records = await db.query.application_records.findMany({
      where: eq(application_records.application_id, applicationId),
      // Oldest first: the model reads the rounds in the order they happened.
      orderBy: [
        asc(application_records.event_date),
        asc(application_records.date_created),
      ],
      // Read a little past the cap so the budget pass has something to choose
      // between rather than being handed a pre-truncated set.
      limit: BUDGETS.full.maxRecords * 2,
    });
    return formatRecordsContext(records, mode);
  } catch {
    // Context is a bonus, never a reason to fail the generation.
    return "";
  }
}
