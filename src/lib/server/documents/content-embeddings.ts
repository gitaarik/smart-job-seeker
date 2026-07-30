/**
 * Generic semantic retrieval over ANY profile content unit — the unit-type-
 * agnostic sibling of project-embeddings.ts, and the scale foundation for the
 * unified generation-context provider (Feature 5).
 *
 * Where project-embeddings.ts ranks projects against a job, this ranks arbitrary
 * units (STAR stories, cheat sheets, application texts, …) against an arbitrary
 * query string, so every AI generator can pull the most relevant slice of a
 * profile no matter how large it grows. Same mechanics as the project layer:
 *
 * GRANULARITY: one vector per unit, keyed (unit_type, unit_id, sub_id). sub_id 0
 * is the unit itself; a positive value is a sub-unit (e.g. an attachment).
 * Retrieval MAX-POOLS a unit's sub-units, so adding a source can only help a
 * unit surface, never wash it out.
 *
 * The corpus is the applicant's OWN content — bounded per profile — so vectors
 * are jsonb + JS cosine, no pgvector. Cache is lazy + hash-gated: each unit's
 * text is hashed and a stored vector reused only while the hash matches, so the
 * first retrieval after any edit re-embeds. See content_embeddings in schema.ts.
 *
 * Degrades to a no-op (returns null) when embeddings are unconfigured or the
 * provider fails — the caller falls back to the deterministic ranker.
 */

import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { dbDirect as db } from "$lib/server/db";
import { content_embeddings } from "$lib/server/db/schema";
import { config } from "$lib/server/config";
import {
  cosineSimilarity,
  embed,
  embedBatch,
  isEmbeddingConfigured,
  truncateVector,
} from "$lib/server/llm/embeddings";

/**
 * One embeddable content unit. `subId` 0 is the unit's own text; a positive
 * value is a sub-unit (mirrors project attachments).
 */
export interface ContentUnit {
  unitType: string;
  unitId: number;
  subId: number;
  embedText: string;
}

/** Stable key for the unit a sub-unit rolls up to (the max-pool bucket). */
export function poolKey(unitType: string, unitId: number): string {
  return `${unitType}:${unitId}`;
}

/** Stable key for a single (sub-)unit. */
function unitKey(u: { unitType: string; unitId: number; subId: number }): string {
  return `${u.unitType}:${u.unitId}:${u.subId}`;
}

/**
 * Content hash gating re-embedding. Model-scoped so swapping the embedding model
 * invalidates every vector (vectors across models are incomparable).
 */
function contentHash(model: string, text: string): string {
  return createHash("sha256").update(`${model}\n${text}`).digest("hex");
}

/**
 * Native-dim embedding vector per unit (keyed by unitKey), embedding + persisting
 * any whose stored vector is missing or stale (content changed, or a different
 * model).
 *
 * Throws on an empty-vector provider failure: an empty vector must never be
 * persisted (it would poison the cache and silently score the unit at 0 forever)
 * — surface it so the caller falls back to lexical. Same contract as
 * project-embeddings.ts / skill-embeddings.ts.
 */
async function getUnitVectors(
  profileId: number,
  units: ContentUnit[],
): Promise<Map<string, number[]>> {
  const model = config.embeddingModel;
  const wantHash = new Map<string, string>();
  for (const u of units) {
    wantHash.set(unitKey(u), contentHash(model, u.embedText));
  }

  // Bounded per-profile corpus — load this profile's vectors for the model and
  // the unit types in play, then match by key in JS.
  const unitTypes = [...new Set(units.map((u) => u.unitType))];
  const rows = unitTypes.length
    ? await db
      .select()
      .from(content_embeddings)
      .where(
        and(
          eq(content_embeddings.profile_id, profileId),
          eq(content_embeddings.model, model),
          inArray(content_embeddings.unit_type, unitTypes),
        ),
      )
    : [];

  const result = new Map<string, number[]>();
  for (const r of rows) {
    const key = unitKey({
      unitType: r.unit_type,
      unitId: r.unit_id,
      subId: r.sub_id,
    });
    if (wantHash.get(key) === r.content_hash) {
      result.set(key, r.embedding as number[]);
    }
  }

  const stale = units.filter((u) => !result.has(unitKey(u)));
  if (stale.length === 0) return result;

  const vectors = await embedBatch(stale.map((u) => u.embedText));
  const now = new Date();
  const toPersist: (typeof content_embeddings.$inferInsert)[] = [];
  const invalid: string[] = [];
  for (let i = 0; i < stale.length; i++) {
    const u = stale[i];
    const vec = vectors[i];
    const key = unitKey(u);
    if (vec?.length > 0) {
      result.set(key, vec);
      toPersist.push({
        profile_id: profileId,
        unit_type: u.unitType,
        unit_id: u.unitId,
        sub_id: u.subId,
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
      .insert(content_embeddings)
      .values(toPersist)
      .onConflictDoUpdate({
        target: [
          content_embeddings.unit_type,
          content_embeddings.unit_id,
          content_embeddings.sub_id,
        ],
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
        `content vectors (model=${model}). Not persisted.`,
    );
  }

  return result;
}

/**
 * Score each unit against the query, keyed by poolKey — a unit's score is the
 * MAX cosine over its sub-units (best-matching sub-unit wins). Returns null —
 * signalling the caller to fall back to the deterministic ranker — when
 * embeddings are unconfigured, there's nothing to rank, or the provider fails.
 * Never throws.
 */
export async function semanticScoreUnits(
  profileId: number,
  units: ContentUnit[],
  queryText: string,
): Promise<Map<string, number> | null> {
  if (!isEmbeddingConfigured() || units.length === 0) return null;
  const query = queryText.trim();
  if (!query) return null;

  try {
    const [unitVectors, queryNative] = await Promise.all([
      getUnitVectors(profileId, units),
      embed(query),
    ]);
    if (!queryNative?.length) return null;

    const dims = config.embeddingWorkingDimensions;
    const queryVec = truncateVector(queryNative, dims);
    const scores = new Map<string, number>();
    for (const u of units) {
      const native = unitVectors.get(unitKey(u));
      if (!native?.length) continue;
      const s = cosineSimilarity(queryVec, truncateVector(native, dims));
      const pk = poolKey(u.unitType, u.unitId);
      const prev = scores.get(pk);
      if (prev === undefined || s > prev) scores.set(pk, s);
    }
    return scores;
  } catch (err) {
    console.warn(
      "[content-embeddings] semantic scoring failed, falling back to lexical:",
      err,
    );
    return null;
  }
}
