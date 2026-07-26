/**
 * Semantic project↔job retrieval — the "R" in the cover-letter / answer RAG.
 *
 * Turns the deterministic keyword-overlap ranker in retrieval.ts into genuine
 * embedding retrieval: embed the applicant's projects (their typed data + any
 * attached-document notes) and the target job, and rank projects by cosine
 * similarity. This catches paraphrase/synonym fit that lexical overlap misses
 * ("orchestration pipeline" ≈ "workflow engine") — the reason it's real RAG and
 * not just a sort.
 *
 * The corpus is the applicant's OWN handful of projects — bounded per profile —
 * so vectors are stored as jsonb and compared with JS cosine, exactly like
 * skill-embeddings.ts. No pgvector.
 *
 * Cache strategy is lazy + hash-gated rather than embed-on-write: projects live
 * in two tables (side_projects, work_experience_projects) whose text is composed
 * from several sub-tables plus attached docs, so hooking every edit path would
 * be fragile. Instead each project's composed text is hashed; a stored vector is
 * reused only while that hash matches, and the first retrieval after any edit
 * re-embeds. See project_embeddings in schema.ts.
 *
 * Everything degrades to a no-op (returns null) when embeddings are
 * unconfigured or the provider fails — the caller then falls back to the
 * deterministic ranker, so this is an enhancement, never a hard dependency.
 */

import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { dbDirect as db } from "$lib/server/db";
import { project_embeddings } from "$lib/server/db/schema";
import { config } from "$lib/server/config";
import {
  cosineSimilarity,
  embed,
  embedBatch,
  isEmbeddingConfigured,
  truncateVector,
} from "$lib/server/llm/embeddings";
import type { JobLike } from "./retrieval";

export type ProjectKind = "side_project" | "work_experience_project";

/** A project reduced to what the embedder needs: an identity + its text. */
export interface EmbeddableProject {
  kind: ProjectKind;
  id: number;
  /** Composed project text (title + context + notes + keywords) to embed. */
  embedText: string;
}

/** Stable map/DB key for a polymorphic project. */
export function projectKey(kind: string, id: number): string {
  return `${kind}:${id}`;
}

/**
 * Content hash gating re-embedding. Model-scoped so swapping the embedding model
 * invalidates every project's vector (vectors across models are incomparable).
 */
function contentHash(model: string, text: string): string {
  return createHash("sha256").update(`${model}\n${text}`).digest("hex");
}

/** The job side of the query: what a relevant project should be near. */
export function buildJobQueryText(job: JobLike): string {
  return [
    job.title,
    job.job_description,
    (job.skills_required ?? []).join(", "),
  ]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .join("\n")
    .trim();
}

/**
 * Native-dim embedding vector per project, embedding + persisting any whose
 * stored vector is missing or stale (content changed, or a different model).
 *
 * Throws on an empty-vector provider failure: like skill-embeddings.ts, an empty
 * vector must never be persisted (it would poison the cache and silently score
 * the project at 0 forever) — surface it so the caller falls back to lexical.
 */
async function getProjectVectors(
  profileId: number,
  projects: EmbeddableProject[],
): Promise<Map<string, number[]>> {
  const model = config.embeddingModel;
  const wantHash = new Map<string, string>();
  for (const p of projects) {
    wantHash.set(projectKey(p.kind, p.id), contentHash(model, p.embedText));
  }

  const ids = projects.map((p) => p.id);
  const rows = ids.length
    ? await db
      .select()
      .from(project_embeddings)
      .where(
        and(
          eq(project_embeddings.profile_id, profileId),
          eq(project_embeddings.model, model),
          inArray(project_embeddings.project_id, ids),
        ),
      )
    : [];

  const result = new Map<string, number[]>();
  for (const r of rows) {
    const key = projectKey(r.kind, r.project_id);
    // Reuse only while the composed text is byte-identical.
    if (wantHash.get(key) === r.content_hash) {
      result.set(key, r.embedding as number[]);
    }
  }

  const stale = projects.filter((p) => !result.has(projectKey(p.kind, p.id)));
  if (stale.length === 0) return result;

  const vectors = await embedBatch(stale.map((p) => p.embedText));
  const now = new Date();
  const toPersist: (typeof project_embeddings.$inferInsert)[] = [];
  const invalid: string[] = [];
  for (let i = 0; i < stale.length; i++) {
    const p = stale[i];
    const vec = vectors[i];
    const key = projectKey(p.kind, p.id);
    if (vec?.length > 0) {
      result.set(key, vec);
      toPersist.push({
        profile_id: profileId,
        kind: p.kind,
        project_id: p.id,
        content_hash: wantHash.get(key)!,
        embedding: vec, // persist NATIVE dim; truncate on read
        model,
        date_created: now,
        date_updated: now,
      });
    } else {
      invalid.push(key);
    }
  }

  if (toPersist.length > 0) {
    await db
      .insert(project_embeddings)
      .values(toPersist)
      .onConflictDoUpdate({
        target: [project_embeddings.kind, project_embeddings.project_id],
        set: {
          profile_id: sql`excluded.profile_id`,
          content_hash: sql`excluded.content_hash`,
          embedding: sql`excluded.embedding`,
          model: sql`excluded.model`,
          date_updated: sql`excluded.date_updated`,
        },
      });
  }

  if (invalid.length > 0) {
    throw new Error(
      `Embedding provider returned ${invalid.length}/${stale.length} empty ` +
        `project vectors (model=${model}). Not persisted.`,
    );
  }

  return result;
}

/**
 * Score each project against the job by embedding cosine, keyed by projectKey.
 * Returns null — signalling the caller to fall back to the deterministic ranker
 * — when embeddings are unconfigured, there's nothing to rank, or the provider
 * fails. Never throws.
 */
export async function semanticScoreProjects(
  profileId: number,
  projects: EmbeddableProject[],
  job: JobLike,
): Promise<Map<string, number> | null> {
  if (!isEmbeddingConfigured() || projects.length === 0) return null;
  const query = buildJobQueryText(job);
  if (!query) return null;

  try {
    const [projVectors, jobNative] = await Promise.all([
      getProjectVectors(profileId, projects),
      embed(query),
    ]);
    if (!jobNative?.length) return null;

    const dims = config.embeddingWorkingDimensions;
    const jobVec = truncateVector(jobNative, dims);
    const scores = new Map<string, number>();
    for (const p of projects) {
      const key = projectKey(p.kind, p.id);
      const native = projVectors.get(key);
      if (!native?.length) continue;
      scores.set(key, cosineSimilarity(jobVec, truncateVector(native, dims)));
    }
    return scores;
  } catch (err) {
    console.warn(
      "[project-embeddings] semantic scoring failed, falling back to lexical:",
      err,
    );
    return null;
  }
}
