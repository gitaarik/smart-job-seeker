/**
 * Render an application's attached documents (the "Documents" tab) as prompt
 * context.
 *
 * These are files the applicant attached to one application — the job posting
 * saved as a PDF, a take-home brief, an offer letter, a recruiter email
 * exported to DOCX. Until now they were download-only: nothing fed their text
 * to the AI generators, so a cover letter could not cite the take-home spec
 * and an answer could not quote a requirement from the JD PDF.
 *
 * ## Extraction is lazy and cached
 *
 * The raw bytes are retained (the Documents tab is a download feature), so we
 * extract on first use through the shared `extractUpload` orchestrator (magic-
 * byte sniff → text extraction → secret redaction — the same path the profile
 * document-ingestion feature uses) and cache the result on the junction row.
 * file_id is immutable (a re-upload is a new row), so a "pending" status means
 * "never extracted" and "skipped" — an unsupported type or a file with no
 * extractable text — is terminal, never retried.
 *
 * ## Why caps rather than retrieval (for now)
 *
 * Like interview records ([[application-records.ts]]), one application has a
 * *handful* of documents, not hundreds, so the capped-verbatim shape fits:
 * hand the model the whole set, trimmed to a budget. The place real retrieval
 * would earn its keep is a single very large document (a 40-page contract),
 * which is intra-document chunking — deferred until a real case appears. See
 * planning/SEMANTIC-MATCHING-AND-RAG.md § Feature 5 Phase 2.
 */

import { db } from "$lib/server/db";
import { asc, eq } from "drizzle-orm";
import { applications_files } from "$lib/server/db/schema";
import { getFile } from "$lib/server/files";
import { extractUpload } from "$lib/server/documents/extract";
import { truncateKeepingEnds } from "./application-records";

/**
 * `full` is for prompts the documents are the subject of (cheat sheets), which
 * want the specifics verbatim. `compact` is for writing prompts (letters,
 * answers), which need the gist at a tighter budget.
 */
export type DocumentContextMode = "compact" | "full";

const BUDGETS: Record<
  DocumentContextMode,
  { perDoc: number; total: number; maxDocs: number }
> = {
  full: { perDoc: 8000, total: 40000, maxDocs: 8 },
  compact: { perDoc: 3000, total: 15000, maxDocs: 6 },
};

/** The shape the formatter needs — kept narrow so tests need no DB row. */
export interface DocForContext {
  title: string | null;
  text: string;
}

function renderBlock(doc: DocForContext, perDoc: number): string {
  return `### Document: ${doc.title?.trim() || "Untitled"}\n\n${
    truncateKeepingEnds(doc.text.trim(), perDoc)
  }`;
}

/**
 * Format documents into a prompt block, applying the per-document and total
 * caps. Pure — no DB access — so the budget behaviour is directly testable.
 */
export function formatDocumentsContext(
  docs: DocForContext[],
  mode: DocumentContextMode = "full",
): string {
  const budget = BUDGETS[mode];
  const withText = docs.filter((d) => d.text?.trim());
  if (withText.length === 0) return "";

  // Documents arrive oldest-first (upload order). Unlike interview records they
  // carry no signal-per-token ranking, so trim by recency: drop the oldest
  // until within the count and total budget. Never drop the last one — a
  // truncated document beats no context at all.
  const kept = [...withText];
  const size = () =>
    kept.reduce((sum, d) => sum + renderBlock(d, budget.perDoc).length, 0);

  let dropped = 0;
  while (kept.length > 1 && (kept.length > budget.maxDocs || size() > budget.total)) {
    kept.shift();
    dropped++;
  }

  // Two audiences, two different risks — mirrors application-records.ts.
  // Outward-facing text (letters, answers) can fabricate a shared history, so
  // its guidance forbids implying the document exists or was acted on. Cheat
  // sheets are private prep notes, so there the pressure is on using the
  // specifics rather than talking around them.
  const guidance = mode === "compact"
    ? [
      "These are documents the applicant attached to this application — the",
      "job posting, a take-home brief, an offer letter, correspondence. Treat",
      "them as authoritative about this specific role and employer: where they",
      "contradict the job posting or an assumption made earlier, the documents",
      "win, and the corrected version is the one to use.",
      "",
      "They do NOT license you to reference the documents themselves, or to",
      "imply the applicant has been sent, has signed or has read anything.",
      "Use the information in them, not the fact that a document exists.",
      "",
      "They may be written in a different language than the text you are",
      "producing. Translate what you use; never drop a point because of the",
      "language it happens to be written in.",
    ]
    : [
      "These are the documents the applicant has attached to this application —",
      "the job posting, briefs, assessments, offer terms, correspondence. Use",
      "their specifics: the exact requirements, the tasks set, the terms",
      "quoted. They are the most concrete information you have about what this",
      "role actually involves — build the preparation around them.",
      "",
      "Where a document sets a task or states a requirement, surface it",
      "explicitly rather than talking around it.",
      "",
      "They may be written in a different language than the text you are",
      "producing. Translate what you use; never drop a point because of the",
      "language it happens to be written in.",
    ];

  const omission = dropped > 0
    ? [
      "",
      `NOTE: ${dropped} further document(s) are attached but were omitted to`,
      "fit. Treat the set below as partial rather than complete.",
    ]
    : [];

  return [
    "## Documents attached to this application",
    "",
    ...guidance,
    ...omission,
    "",
    kept.map((d) => renderBlock(d, budget.perDoc)).join("\n\n---\n\n"),
  ].join("\n");
}

/** The junction-row shape the extractor needs. */
interface DocRow {
  id: number;
  file_id: string | null;
  extracted_text: string | null;
  extraction_status: string;
  file: { filename_download: string; title: string | null } | null;
}

/**
 * Return an attached file's extracted text, extracting + caching it on first
 * use. Terminal states ("extracted"/"skipped") short-circuit; any failure is
 * recorded as "skipped" so it is never retried, and never fails the caller —
 * context is a bonus, not a precondition.
 */
async function ensureExtracted(row: DocRow): Promise<string | null> {
  if (row.extraction_status === "extracted") {
    return row.extracted_text?.trim() || null;
  }
  if (row.extraction_status === "skipped") return null;

  if (!row.file_id) {
    await markSkipped(row.id, "no file attached");
    return null;
  }

  try {
    const buffer = await getFile(row.file_id);
    const filename = row.file?.filename_download || "document";
    const result = await extractUpload({ filename, bytes: buffer });
    const text = result.files.map((f) => f.text).join("\n\n").trim();
    if (!text) {
      await markSkipped(row.id, "no extractable text");
      return null;
    }
    await db.update(applications_files).set({
      extracted_text: text,
      extraction_status: "extracted",
      extraction_error: null,
      date_extracted: new Date(),
    }).where(eq(applications_files.id, row.id));
    return text;
  } catch (err) {
    await markSkipped(row.id, (err as Error).message);
    return null;
  }
}

async function markSkipped(id: number, reason: string): Promise<void> {
  await db.update(applications_files).set({
    extraction_status: "skipped",
    extraction_error: reason.slice(0, 2000),
    date_extracted: new Date(),
  }).where(eq(applications_files.id, id));
}

/**
 * Load an application's attached documents, extract any not yet cached, and
 * render them as prompt context. Returns "" when nothing is attached or
 * nothing yields text — callers interpolate it blindly.
 */
export async function applicationDocumentsText(
  applicationId: number,
  mode: DocumentContextMode = "full",
): Promise<string> {
  try {
    const rows = await db.query.applications_files.findMany({
      where: eq(applications_files.applications_id, applicationId),
      // Oldest first (upload order) so the budget trim drops the oldest.
      orderBy: asc(applications_files.id),
      // Read a little past the cap so the budget pass has something to choose
      // between, and to bound extraction work on a pathological attachment count.
      limit: BUDGETS.full.maxDocs * 2,
      with: {
        file: { columns: { filename_download: true, title: true } },
      },
    });

    const docs: DocForContext[] = [];
    for (const row of rows) {
      const text = await ensureExtracted(row as DocRow);
      if (text) {
        docs.push({
          title: row.file?.title || row.file?.filename_download || null,
          text,
        });
      }
    }
    return formatDocumentsContext(docs, mode);
  } catch {
    // Context is a bonus, never a reason to fail the generation.
    return "";
  }
}
