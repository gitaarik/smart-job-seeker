/**
 * Everything that has happened on an application, rendered as prompt context.
 *
 * This is the merge of what were `application-records.ts` (typed text) and
 * `application-documents.ts` (uploaded files). They were separate because the
 * schema was: records held prose, `applications_files` held blobs. That split
 * only ever sorted artefacts by whether their source had a download button — an
 * email exports cleanly and became a document, the same conversation on
 * LinkedIn had to be pasted and became a record — so the model saw one
 * application's history through two differently-worded windows with two
 * independent budgets. One stream, one budget, one guidance block.
 *
 * See planning/APPLICATION-ACTIVITY.md.
 *
 * ## Why caps rather than retrieval
 *
 * Writing prompts run on the writing provider (Gemini 2.5 Pro, 1M context)
 * falling back to gpt-oss-120b (131k), and ONE application holds a couple of
 * dozen entries at most, so the whole set fits and can be handed over verbatim.
 *
 * Retrieval would also be actively worse here: the value of this stream is
 * sequential ("round 2 pushed on caching"), and top-k similarity returns
 * fragments out of order. Retrieval earns its keep across HUNDREDS of units —
 * which is exactly the cross-application case, and exactly why that is a
 * separate `app_record` / `app_document` unit type on the generic retrieval
 * layer rather than a change to this module.
 */

import { db } from "$lib/server/db";
import { asc, eq } from "drizzle-orm";
import { application_records, applications_files } from "$lib/server/db/schema";
import { getFile } from "$lib/server/files";
import { extractUpload } from "$lib/server/documents/extract";
import { getRecordTypeLabel } from "$lib/application-records";

/**
 * `full` is for prompts the history is *about* (cheat sheets), where it is the
 * subject. `compact` is for writing prompts (letters, application answers),
 * which need the gist rather than the transcript.
 */
export type ActivityContextMode = "compact" | "full";

/**
 * Per-type trim rank AND char ceiling, from one table.
 *
 * These were two independent judgements before — `TRIM_ORDER` said what to
 * sacrifice, `BUDGETS.perRecord` said how much of it to keep — both encoding
 * "how much does this kind of thing matter". Two tables saying the same thing
 * drift apart the first time a type is added to one and not the other.
 *
 * `rank` is lowest-value-first: rank 0 is sacrificed first. A raw transcript is
 * the least efficient way to say what happened; a recap or a piece of feedback
 * is the most; an offer or a signed contract should be the last thing dropped.
 *
 * ⚠️ EVERY value in `recordTypes` must appear here — `weightFor` falls back to
 * rank 0, which means "sacrifice first", so a type added to the vocabulary and
 * forgotten here quietly becomes cheaper than a raw transcript instead of
 * dearer. There is a test asserting the two stay in step.
 */
export const RECORD_WEIGHTS: Record<string, { rank: number; ceiling: number }> =
  {
    transcript: { rank: 0, ceiling: 4000 },
    note: { rank: 1, ceiling: 2000 },
    research: { rank: 2, ceiling: 2000 },
    message: { rank: 3, ceiling: 2000 },
    assessment: { rank: 4, ceiling: 4000 },
    feedback: { rank: 5, ceiling: 4000 },
    interview_recap: { rank: 6, ceiling: 4000 },
    offer: { rank: 7, ceiling: 8000 },
    contract: { rank: 8, ceiling: 8000 },
  };

const FALLBACK_WEIGHT = { rank: 0, ceiling: 2000 };

function weightFor(recordType: string | null) {
  return RECORD_WEIGHTS[recordType || "note"] ?? FALLBACK_WEIGHT;
}

/**
 * Compact mode scales every ceiling by one constant rather than restating the
 * table. 0.375 is what both predecessors already used (records 1500/4000,
 * documents 3000/8000 — the same ratio by coincidence, kept deliberately).
 */
const COMPACT_SCALE = 0.375;

const TOTALS: Record<
  ActivityContextMode,
  { total: number; maxEntries: number }
> = {
  full: { total: 40000, maxEntries: 16 },
  compact: { total: 15000, maxEntries: 10 },
};

function ceilingFor(entry: ActivityEntry, mode: ActivityContextMode): number {
  const base = weightFor(entry.record_type).ceiling;
  return mode === "compact" ? Math.round(base * COMPACT_SCALE) : base;
}

/** The shape the formatter needs — kept narrow so tests need no DB row. */
export interface ActivityEntry {
  record_type: string | null;
  title: string | null;
  content: string | null;
  step: string | null;
  event_date: string | null;
  /**
   * Whether this entry's text was extracted from an attached file rather than
   * written. Worth telling the model: extracted text is verbatim from a third
   * party, so its phrasing is evidence, where a typed recap is the applicant's
   * own paraphrase.
   */
  from_file?: boolean;
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

function renderBlock(entry: ActivityEntry, mode: ActivityContextMode): string {
  const heading = [
    `### ${getRecordTypeLabel(entry.record_type)}: ${
      entry.title?.trim() || "Untitled"
    }`,
    entry.step ? `Stage: ${entry.step}` : null,
    entry.event_date ? `Date: ${entry.event_date}` : null,
    entry.from_file ? "Source: text extracted from an attached file" : null,
  ].filter(Boolean).join("\n");

  return `${heading}\n\n${
    truncateKeepingEnds(entry.content!.trim(), ceilingFor(entry, mode))
  }`;
}

/**
 * Format the stream into a prompt block, applying the per-entry ceilings and
 * the total cap. Pure — no DB access — so the budget behaviour is directly
 * testable.
 */
export function formatActivityContext(
  entries: ActivityEntry[],
  mode: ActivityContextMode = "full",
): string {
  const budget = TOTALS[mode];
  const withContent = entries.filter((e) => e.content?.trim());
  if (withContent.length === 0) return "";

  // Entries arrive oldest-first. Drop lowest-value types first and, within a
  // type, the oldest — so what survives is the most recent and most useful.
  const kept = [...withContent];
  const dropOrder = withContent
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) =>
      weightFor(a.entry.record_type).rank -
        weightFor(b.entry.record_type).rank ||
      a.index - b.index
    );

  let dropped = 0;
  const size = () =>
    kept.reduce((sum, e) => sum + renderBlock(e, mode).length, 0);

  for (const { entry } of dropOrder) {
    if (kept.length <= budget.maxEntries && size() <= budget.total) break;
    // Never drop the last one — a truncated entry beats no context at all.
    if (kept.length === 1) break;
    kept.splice(kept.indexOf(entry), 1);
    dropped++;
  }

  // Two audiences, two different risks. Outward-facing text (letters, answers)
  // can invent a shared history that never happened, so its guidance separates
  // *what was learned* from *the fact that it was learned* — which is a sharper
  // fabrication guard than "use them only where they help", and simultaneously
  // stops the stream being skimmed as optional colour. Cheat sheets are private
  // prep notes: referencing the history is the whole point, so there the
  // pressure is all on acting rather than nodding.
  //
  // The compact guard covers BOTH predecessors' risks, because the stream is
  // now mixed: never imply a conversation that did not happen (records), and
  // never imply the applicant has been sent, has signed or has read anything
  // (documents). Either fabrication is reachable from any entry now.
  // NOTE ON WRAPPING: these lines are joined with "\n", so a clause split
  // across two entries never appears contiguously in the output. The wrapping
  // is chosen so each load-bearing phrase stays whole and can be asserted on —
  // break "Never imply a conversation" over a line and the guard silently stops
  // being testable while still reading fine to a human.
  const guidance = mode === "compact"
    ? [
      "This is the applicant's own record of what has happened on this",
      "application: correspondence, interview rounds, feedback, briefs, offers,",
      "and the documents they attached. Treat it as the most reliable",
      "information you have about this employer and this role: where it",
      "contradicts the job posting or an assumption the applicant made earlier,",
      "the record wins, and the corrected version is the one to use.",
      "",
      "It does NOT license you to reference the interaction itself.",
      "Never imply a conversation, meeting or relationship that is not",
      "recorded below, and never imply the applicant has been sent,",
      "has signed, or has read anything — the text you are writing may well",
      "predate all of it.",
      "Use what was learned, not the fact that it was learned.",
      "",
      "It may be written in a different language than the text you are",
      "producing. Translate what you use; never drop a point because of the",
      "language it happens to be written in.",
    ]
    : [
      "This is the applicant's own record of earlier rounds, feedback,",
      "correspondence and the documents attached to this application. It is",
      "the most important input you have: act on it,",
      "do not merely acknowledge it. Build on what was already discussed,",
      "address the concerns that were raised, use the exact requirements and",
      "tasks that were set, and do not re-prepare ground already covered.",
      "",
      "Where it corrects something the applicant got wrong, sets a task, or",
      "recommends specific preparation, that correction and that",
      "recommendation are the point — surface them explicitly rather than",
      "quietly working around them.",
      "",
      "It may be written in a different language than the text you are",
      "producing. Translate what you use; never drop a point because of the",
      "language it happens to be written in.",
    ];

  const omission = dropped > 0
    ? [
      "",
      `NOTE: ${dropped} further entry(s) exist but were omitted to fit. Treat`,
      "the picture below as partial rather than complete.",
    ]
    : [];

  return [
    "## What has already happened in this application",
    "",
    ...guidance,
    ...omission,
    "",
    kept.map((e) => renderBlock(e, mode)).join("\n\n---\n\n"),
  ].join("\n");
}

/** The junction/record shape the extractor needs. */
interface ExtractableRow {
  id: number;
  file_id: string | null;
  extraction_status: string;
  file: { filename_download: string; title: string | null } | null;
}

/**
 * Return a file-backed row's extracted text, extracting and caching it on first
 * use. Terminal states ("extracted"/"skipped") short-circuit; any failure is
 * recorded as "skipped" so it is never retried, and never fails the caller —
 * context is a bonus, not a precondition.
 *
 * `table` is passed because the same lifecycle runs against `application_records`
 * (the new home) and `applications_files` (until the cutover drops it).
 */
async function ensureExtracted(
  row: ExtractableRow,
  table: typeof application_records | typeof applications_files,
  cached: string | null,
): Promise<string | null> {
  if (row.extraction_status === "extracted") return cached?.trim() || null;
  if (row.extraction_status === "skipped") return null;

  if (!row.file_id) {
    await markSkipped(row.id, "no file attached", table);
    return null;
  }

  try {
    const buffer = await getFile(row.file_id);
    const filename = row.file?.filename_download || "document";
    const result = await extractUpload({ filename, bytes: buffer });
    const text = result.files.map((f) => f.text).join("\n\n").trim();
    if (!text) {
      await markSkipped(row.id, "no extractable text", table);
      return null;
    }
    // The extracted text lands in the row's own text column: `content` for a
    // record (where it stays user-editable — fix bad OCR, trim a quoted reply
    // chain), `extracted_text` for a legacy junction row.
    const column = table === application_records
      ? { content: text }
      : { extracted_text: text };
    await db.update(table).set({
      ...column,
      extraction_status: "extracted",
      extraction_error: null,
      date_extracted: new Date(),
      // deno-lint-ignore no-explicit-any -- two tables, structurally identical
      // extraction columns, different text column; narrowing this properly
      // would mean two near-identical functions for the weeks until cutover.
    } as any).where(eq(table.id, row.id));
    return text;
  } catch (err) {
    await markSkipped(row.id, (err as Error).message, table);
    return null;
  }
}

async function markSkipped(
  id: number,
  reason: string,
  table: typeof application_records | typeof applications_files,
): Promise<void> {
  await db.update(table).set({
    extraction_status: "skipped",
    extraction_error: reason.slice(0, 2000),
    date_extracted: new Date(),
    // deno-lint-ignore no-explicit-any -- see ensureExtracted
  } as any).where(eq(table.id, id));
}

/**
 * Load everything recorded against an application and render it as prompt
 * context. Returns "" when there is nothing — callers interpolate it blindly.
 *
 * ⚠️ TEMPORARY DUAL READ. `applications_files` is still the Documents tab's
 * write target, so its rows are unioned in here. Both halves are deleted at
 * cutover (step 5 of the plan) when the tab goes and the rows are moved into
 * `application_records`. Copying the data earlier would diverge from every
 * upload made in between, which is why this reads two tables instead.
 */
export async function applicationActivityText(
  applicationId: number,
  mode: ActivityContextMode = "full",
): Promise<string> {
  try {
    const cap = TOTALS.full.maxEntries * 2;

    const [records, legacyFiles] = await Promise.all([
      db.query.application_records.findMany({
        where: eq(application_records.application_id, applicationId),
        // Oldest first: the model reads the rounds in the order they happened.
        orderBy: [
          asc(application_records.event_date),
          asc(application_records.date_created),
        ],
        // Read a little past the cap so the budget pass has something to choose
        // between rather than being handed a pre-truncated set.
        limit: cap,
        with: {
          file: { columns: { filename_download: true, title: true } },
        },
      }),
      db.query.applications_files.findMany({
        where: eq(applications_files.applications_id, applicationId),
        orderBy: asc(applications_files.id),
        limit: cap,
        with: {
          file: { columns: { filename_download: true, title: true } },
        },
      }),
    ]);

    const entries: ActivityEntry[] = [];

    for (const row of records) {
      const content = row.file_id
        ? await ensureExtracted(
          row as ExtractableRow,
          application_records,
          row.content,
        )
        : row.content;
      if (!content?.trim()) continue;
      entries.push({
        record_type: row.record_type,
        title: row.title,
        content,
        step: row.step,
        event_date: row.event_date,
        from_file: !!row.file_id,
      });
    }

    for (const row of legacyFiles) {
      const text = await ensureExtracted(
        row as ExtractableRow,
        applications_files,
        row.extracted_text,
      );
      if (!text?.trim()) continue;
      entries.push({
        // Matches what the cutover migration will type these as: a file someone
        // attached is far more likely received than written, so `message`
        // ("correspondence, sender unknown") is the honest default.
        record_type: "message",
        title: row.file?.title || row.file?.filename_download || null,
        content: text,
        step: null,
        event_date: null,
        from_file: true,
      });
    }

    return formatActivityContext(entries, mode);
  } catch {
    // Context is a bonus, never a reason to fail the generation.
    return "";
  }
}
