/**
 * Project ↔ job relevance retrieval.
 *
 * Given a job, rank the profile's document projects by how relevant they are,
 * so a cover letter / application answer can cite only the projects that
 * matter (instead of dumping every summary into the prompt).
 *
 * v1 is DETERMINISTIC — keyword/skill overlap against the job. It needs no
 * embedding layer (which is gated off in every env). A semantic ranker
 * (project-summary vectors) is a drop-in upgrade behind SJS_EMBEDDING_ENABLED;
 * see planning/SEMANTIC-MATCHING-AND-RAG.md. Keep the same return shape.
 */

import { dbDirect as db } from "$lib/server/db";
import { asc, desc, eq } from "drizzle-orm";
import { profile_document_projects } from "$lib/server/db/schema";

export interface JobLike {
  title?: string | null;
  job_description?: string | null;
  skills_required?: string[] | null;
}

export interface ProjectForRanking {
  id: number;
  title: string;
  summary: string;
  keywords: string[];
}

export interface RankedProject extends ProjectForRanking {
  score: number;
}

/** Normalize for loose token matching; keep tech chars like + # . */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ")
    .trim();
}

/**
 * Overlap score of one project against a job. Explicit skill matches weigh more
 * than an incidental mention in the job text. Pure — unit-testable.
 */
export function scoreProjectAgainstJob(
  project: ProjectForRanking,
  job: JobLike,
): number {
  const jobSkills = (job.skills_required ?? []).map(norm).filter(Boolean);
  const jobText = norm(
    [job.title, job.job_description, ...(job.skills_required ?? [])]
      .filter(Boolean)
      .join(" "),
  );

  let score = 0;
  for (const raw of project.keywords ?? []) {
    const kw = norm(raw);
    if (kw.length < 2) continue;

    const skillMatch = jobSkills.some((s) =>
      s === kw ||
      (kw.length >= 3 && s.includes(kw)) ||
      (s.length >= 3 && kw.includes(s))
    );
    if (skillMatch) {
      score += 3; // strong: matches a required skill
      continue;
    }
    // weak: the keyword shows up somewhere in the job text
    if (kw.length >= 3 && jobText.includes(kw)) score += 1;
  }
  return score;
}

/** Rank projects by relevance to a job; drop zero-score, take top K. Pure. */
export function rankProjects(
  projects: ProjectForRanking[],
  job: JobLike,
  k = 3,
): RankedProject[] {
  return projects
    .map((p) => ({ ...p, score: scoreProjectAgainstJob(p, job) }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/**
 * Format ranked projects into a self-contained prompt block (its own header, so
 * callers just interpolate it). Returns "" when there are no matches — no
 * dangling header. Summaries are clipped to keep the prompt lean.
 */
export function formatRelevantProjects(ranked: RankedProject[]): string {
  if (ranked.length === 0) return "";
  const items = ranked.map((p, i) => {
    const title = p.title.trim() || `Project ${p.id}`;
    const summary = p.summary.length > 600
      ? p.summary.slice(0, 600).trimEnd() + "…"
      : p.summary;
    return `${i + 1}. ${title}\n${summary}`;
  });
  return "## Relevant projects from the applicant's uploaded work\n\n" +
    "These are the applicant's REAL projects (extracted from documents they " +
    "uploaded). You MAY cite them alongside the profile above; ground any " +
    "project claim only in the notes here — do not invent details.\n\n" +
    items.join("\n\n");
}

/**
 * One-call convenience for prompt call sites: load + rank + format the top-K
 * projects relevant to a job, returning a ready-to-interpolate string ("" if
 * none). `job.skills_required` may be passed straight from the (untyped json)
 * jobs column — cast it to string[] | null at the call site.
 */
export async function relevantProjectsText(
  profileId: number,
  job: JobLike,
  k = 3,
): Promise<string> {
  const ranked = await relevantProjects(profileId, job, k);
  return formatRelevantProjects(ranked);
}

/**
 * Load a profile's summarized document projects and return the top-K relevant
 * to `job`. Only projects with a summary are eligible (that's what gets cited).
 */
export async function relevantProjects(
  profileId: number,
  job: JobLike,
  k = 3,
): Promise<RankedProject[]> {
  const rows = await db.query.profile_document_projects.findMany({
    where: eq(profile_document_projects.profile_id, profileId),
    orderBy: [
      asc(profile_document_projects.sort),
      desc(profile_document_projects.date_created),
    ],
    columns: { id: true, title: true, summary: true, keywords: true },
  });

  const projects: ProjectForRanking[] = rows
    .filter((r) => (r.summary ?? "").trim().length > 0)
    .map((r) => ({
      id: r.id,
      title: r.title ?? "",
      summary: r.summary ?? "",
      keywords: Array.isArray(r.keywords) ? (r.keywords as string[]) : [],
    }));

  return rankProjects(projects, job, k);
}
