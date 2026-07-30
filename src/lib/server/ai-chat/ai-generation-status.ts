/**
 * Tracks whether an LLM generation is currently in flight for an entity, so an
 * editor reloaded mid-generation can show a resumable "AI is working…" state
 * (and poll for the result) instead of silently losing the client-side spinner.
 *
 * A row in `ai_generations` exists only while a generation runs: `begin` inserts
 * it, `end` deletes it in a finally — so it clears even when the client has
 * navigated away (the server handler runs to completion regardless). The
 * `started_at` TTL is the backstop for the one case a finally can't cover: the
 * server process dying mid-generation. Reads treat an older-than-TTL row as not
 * running and clean it up opportunistically.
 *
 * This is deliberately decoupled from `ai_chats` / the entity's `ai_chat_id`
 * (which is only linked after the LLM returns) so it never touches the existing
 * generate/followup logic.
 */

import { dbDirect as db } from "$lib/server/db";
import { and, eq, lt } from "drizzle-orm";
import { ai_generations } from "$lib/server/db/schema";

/** Entities that run tracked generations. Plain strings in the DB. */
export type GenerationEntity = "story" | "letter" | "question";

/** A generation older than this is treated as dead (crashed) and ignored. */
const STALE_MS = 5 * 60 * 1000;

/** Mark a generation as started (upsert — one in-flight row per entity). */
export async function beginGeneration(
  entityType: GenerationEntity,
  entityId: number,
  mode?: string | null,
): Promise<void> {
  await db
    .insert(ai_generations)
    .values({
      entity_type: entityType,
      entity_id: entityId,
      mode: mode ?? null,
    })
    .onConflictDoUpdate({
      target: [ai_generations.entity_type, ai_generations.entity_id],
      set: { started_at: new Date(), mode: mode ?? null },
    });
}

/** Mark a generation as finished (idempotent). */
export async function endGeneration(
  entityType: GenerationEntity,
  entityId: number,
): Promise<void> {
  await db.delete(ai_generations).where(
    and(
      eq(ai_generations.entity_type, entityType),
      eq(ai_generations.entity_id, entityId),
    ),
  );
}

/**
 * Whether a (non-stale) generation is running for the entity. Sweeps the stale
 * row for this entity on the way, so a crashed generation self-heals on the next
 * read rather than pinning the "working…" banner forever.
 */
export async function isGenerating(
  entityType: GenerationEntity,
  entityId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ started_at: ai_generations.started_at })
    .from(ai_generations)
    .where(
      and(
        eq(ai_generations.entity_type, entityType),
        eq(ai_generations.entity_id, entityId),
      ),
    )
    .limit(1);
  if (!row) return false;
  if (Date.now() - row.started_at.getTime() > STALE_MS) {
    await db.delete(ai_generations).where(
      and(
        eq(ai_generations.entity_type, entityType),
        eq(ai_generations.entity_id, entityId),
        lt(ai_generations.started_at, new Date(Date.now() - STALE_MS)),
      ),
    );
    return false;
  }
  return true;
}

/**
 * Run a generation with its in-flight marker set for the duration. The marker is
 * cleared in a finally — so it clears on success, on error, and even when the
 * client disconnected mid-request (the handler still runs to completion).
 */
export async function trackGeneration<T>(
  entityType: GenerationEntity,
  entityId: number,
  mode: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await beginGeneration(entityType, entityId, mode);
  try {
    return await fn();
  } finally {
    await endGeneration(entityType, entityId);
  }
}
