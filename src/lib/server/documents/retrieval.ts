/**
 * Project ↔ job relevance retrieval.
 *
 * Ranks the applicant's ACTUAL projects — their work-experience projects and
 * side (personal) projects — against a job, so a cover letter / application
 * answer cites only the ones that fit. Each project is scored on BOTH what the
 * user typed (name, description, outcome, technologies, achievements) AND what
 * any attached source/docs revealed (the uploaded documents' summary +
 * keywords). This unifies the two signals instead of ranking uploaded files as
 * a separate list.
 *
 * v1 is DETERMINISTIC — keyword/skill overlap. It needs no embedding layer
 * (gated off in every env). A semantic ranker is a drop-in upgrade behind
 * SJS_EMBEDDING_ENABLED; see planning/SEMANTIC-MATCHING-AND-RAG.md.
 */

import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { side_projects, work_experiences } from "$lib/server/db/schema";

export interface JobLike {
  title?: string | null;
  job_description?: string | null;
  skills_required?: string[] | null;
}

/** A project (typed + doc-enriched) that can be ranked against a job. */
export interface RankableProject {
  kind: "side_project" | "work_experience_project";
  id: number;
  title: string;
  /** e.g. "at Acme Corp" for a work-experience project; "" for a side project. */
  context: string;
  /** Technologies (typed) ∪ attached-document keywords — for skill matching. */
  keywords: string[];
  /** Description / outcome / achievements prose — for text matching. */
  text: string;
  /** The rich blurb handed to the writer to cite. */
  citation: string;
}

/** Normalize for loose token matching; keep tech chars like + # . */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ")
    .trim();
}

/**
 * Overlap score of one project against a job. An explicit required-skill match
 * (via a technology or doc keyword) weighs most; a job skill merely appearing
 * in the project's own prose also counts. Pure — unit-testable.
 */
export function scoreProjectAgainstJob(
  project: { keywords: string[]; text?: string },
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
      score += 3;
      continue;
    }
    if (kw.length >= 3 && jobText.includes(kw)) score += 1;
  }
  // A required skill mentioned in the project's own prose also counts.
  if (project.text) {
    const ptext = norm(project.text);
    for (const s of jobSkills) {
      if (s.length >= 3 && ptext.includes(s)) score += 1;
    }
  }
  return score;
}

/** Rank projects by relevance to a job; drop zero-score, take top K. Pure. */
export function rankProjects<T extends { keywords: string[]; text?: string }>(
  projects: T[],
  job: JobLike,
  k = 3,
): (T & { score: number })[] {
  return projects
    .map((p) => ({ ...p, score: scoreProjectAgainstJob(p, job) }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

const clip = (s: string, n: number): string =>
  s.length > n ? s.slice(0, n).trimEnd() + "…" : s;

function asStrings(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const t = s.trim();
    const key = t.toLowerCase();
    if (t && !seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

function buildCitation(
  description: string,
  docSummaries: string[],
  techs: string[],
): string {
  const parts: string[] = [];
  if (description.trim()) parts.push(description.trim());
  if (docSummaries.length) parts.push(docSummaries.join(" "));
  if (techs.length) parts.push(`Technologies: ${techs.join(", ")}.`);
  return clip(parts.join(" ").trim(), 800);
}

/**
 * Load the applicant's projects (work-experience + side), fold in any attached
 * documents, and return the top-K relevant to `job`.
 */
export async function relevantProfileProjects(
  profileId: number,
  job: JobLike,
  k = 3,
): Promise<(RankableProject & { score: number })[]> {
  const [sideRows, weRows] = await Promise.all([
    db.query.side_projects.findMany({
      where: eq(side_projects.profile_id, profileId),
      columns: { id: true, name: true, summary: true },
      with: {
        side_project_technologies: { columns: { name: true } },
        side_project_achievements: { columns: { description: true } },
        profile_document_projects: {
          columns: { summary: true, keywords: true },
        },
      },
    }),
    db.query.work_experiences.findMany({
      where: eq(work_experiences.profile_id, profileId),
      columns: { id: true, name: true },
      with: {
        work_experience_projects: {
          columns: { id: true, name: true, description: true, outcome: true },
          with: {
            work_experience_project_technologies: { columns: { name: true } },
            profile_document_projects: {
              columns: { summary: true, keywords: true },
            },
          },
        },
      },
    }),
  ]);

  const projects: RankableProject[] = [];

  for (const sp of sideRows) {
    if (!sp.name?.trim()) continue;
    const techs = sp.side_project_technologies
      .map((t) => t.name ?? "")
      .filter(Boolean);
    const docKeywords = sp.profile_document_projects.flatMap((d) =>
      asStrings(d.keywords)
    );
    const docSummaries = sp.profile_document_projects
      .map((d) => d.summary ?? "")
      .filter(Boolean);
    const achievements = sp.side_project_achievements
      .map((a) => a.description ?? "")
      .filter(Boolean);
    const description = [sp.summary ?? "", ...achievements].filter(Boolean)
      .join(" ");
    projects.push({
      kind: "side_project",
      id: sp.id,
      title: sp.name.trim(),
      context: "",
      keywords: dedupe([...techs, ...docKeywords]),
      text: description,
      citation: buildCitation(description, docSummaries, techs),
    });
  }

  for (const we of weRows) {
    for (const wep of we.work_experience_projects) {
      if (!wep.name?.trim()) continue;
      const techs = wep.work_experience_project_technologies
        .map((t) => t.name ?? "")
        .filter(Boolean);
      const docKeywords = wep.profile_document_projects.flatMap((d) =>
        asStrings(d.keywords)
      );
      const docSummaries = wep.profile_document_projects
        .map((d) => d.summary ?? "")
        .filter(Boolean);
      const description = [wep.description ?? "", wep.outcome ?? ""]
        .filter(Boolean)
        .join(" ");
      projects.push({
        kind: "work_experience_project",
        id: wep.id,
        title: wep.name.trim(),
        context: we.name ? `at ${we.name}` : "",
        keywords: dedupe([...techs, ...docKeywords]),
        text: description,
        citation: buildCitation(description, docSummaries, techs),
      });
    }
  }

  return rankProjects(projects, job, k);
}

/**
 * Format ranked projects into a self-contained prompt block (its own header, so
 * callers just interpolate it). Returns "" when there are no matches.
 */
export function formatProjectCitations(ranked: RankableProject[]): string {
  if (ranked.length === 0) return "";
  const items = ranked.map((p, i) => {
    const head = p.context ? `${p.title} (${p.context})` : p.title;
    return `${i + 1}. ${head}\n${p.citation}`;
  });
  return "## Relevant projects from the applicant\n\n" +
    "These are the applicant's REAL projects — from their work experience, " +
    "personal projects, and any source/docs they uploaded. Cite the ones that " +
    "fit this role; ground every claim only in the notes here, do not invent.\n\n" +
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
  const ranked = await relevantProfileProjects(profileId, job, k);
  return formatProjectCitations(ranked);
}
