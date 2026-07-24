/**
 * Per-project summarizer.
 *
 * Condenses an extracted project (its source/doc files) into resume-usable
 * "reference notes" + key technologies via the app (Groq) LLM. This is the
 * retrievable unit for job-aware prompts — it is NOT merged into
 * collected_data. Credits are charged automatically by token count inside
 * runProfileAiChat. Best-effort: returns null on failure so the upload still
 * succeeds without a summary. See planning/DOCUMENT-INGESTION.md § AI.
 */

import { runProfileAiChat } from "$lib/server/ai-chat/job-utils";

export interface ProjectSummary {
  summary: string;
  keywords: string[];
}

/**
 * The minimal shape the summarizer needs — satisfied by both freshly-extracted
 * files (ExtractedFile) and rows re-read from the DB for a reparse.
 */
export interface SummarizableFile {
  path: string;
  text: string;
}

// Budget for the concatenated blob handed to the summarizer. A project can be
// far larger than any context window, so cap per-file and total.
const PER_FILE_CHARS = 8000;
const TOTAL_CHARS = 48000;

function isDoc(path: string): boolean {
  return /(^|\/)readme|\.(md|mdx|txt|rst|adoc)$/i.test(path);
}

/**
 * Build a bounded, readable document blob from the extracted files. Docs /
 * READMEs go first (they describe a project best), then the rest by path.
 */
export function buildDocumentBlob(files: SummarizableFile[]): string {
  const ordered = [...files].sort((a, b) => {
    const rank = (f: SummarizableFile) => (isDoc(f.path) ? 0 : 1);
    return rank(a) - rank(b) || a.path.localeCompare(b.path);
  });

  const parts: string[] = [];
  let total = 0;
  for (const f of ordered) {
    if (total >= TOTAL_CHARS) break;
    const chunk = `\n\n=== ${f.path} ===\n${f.text.slice(0, PER_FILE_CHARS)}`;
    const clipped = chunk.slice(0, TOTAL_CHARS - total);
    parts.push(clipped);
    total += clipped.length;
  }
  return parts.join("").trim();
}

export async function summarizeProject(
  profileId: number,
  files: SummarizableFile[],
): Promise<ProjectSummary | null> {
  const document = buildDocumentBlob(files);
  if (!document) return null;

  const result = await runProfileAiChat<
    { summary?: string | null; keywords?: string[] | null }
  >(profileId, "extract_document", { document });

  if (!result.success || !result.response) return null;

  const summary = (result.response.summary ?? "").trim();
  const keywords = Array.isArray(result.response.keywords)
    ? result.response.keywords.map((k) => String(k).trim()).filter(Boolean)
    : [];

  if (!summary && keywords.length === 0) return null;
  return { summary, keywords };
}
