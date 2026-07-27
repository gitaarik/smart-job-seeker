/**
 * Drop the bulky debug payload of old `ai_chats` rows.
 *
 * `ai_chats` records every LLM call and nothing ever deleted from it, so it
 * grows without bound — on dev it reached 134k rows / 6.8 GB, 95% of the whole
 * database, which is what made `full.sql` dumps enormous.
 *
 * Almost all of that is two columns: `full_prompt` (the fully-interpolated
 * prompt, including profile data and stripped page HTML) and `context` (json).
 * Together they are ~45 kB of a 47 kB row. Everything queried later — model,
 * provider, request_type, token counts, response, and the short system/user
 * prompts — is small.
 *
 * So this tombstones rather than deletes: the row, its token/cost history and
 * the 8 FKs pointing at `ai_chats` all survive, and only the two heavy debug
 * columns are nulled. Deleting whole rows would also be FK-safe (every inbound
 * FK is ON DELETE SET NULL) but would throw away the cost history.
 *
 * Nulling is NOT reversible. Run periodically from the worker. Idempotent —
 * already-nulled rows are skipped by the WHERE clause, so a repeat pass is a
 * cheap no-op.
 *
 * NOTE: this reclaims space *for reuse by Postgres*; it does not shrink the
 * table file on disk. Only a table rewrite does that, and VACUUM FULL takes an
 * ACCESS EXCLUSIVE lock — never do that on a schedule. `scripts/prune-ai-chats.ts
 * --vacuum` exists for the deliberate, one-off reclaim during maintenance.
 */

import { and, inArray, isNotNull, lt, or } from "drizzle-orm";
import { dbDirect as db } from "$lib/server/db";
import { ai_chats } from "$lib/server/db/schema";

export interface AiChatRetentionResult {
  rowsPruned: number;
  /** True when the batch limit was hit, so rows older than the window remain. */
  moreRemaining: boolean;
}

export interface AiChatRetentionOptions {
  /** Rows older than this keep only their small analytics columns. */
  days: number;
  /**
   * Cap on rows per pass. A first run against a large backlog would otherwise
   * rewrite millions of rows in a single statement; the caller's schedule
   * catches up over subsequent passes.
   */
  limit?: number;
}

export const DEFAULT_RETENTION_DAYS = 30;
export const DEFAULT_BATCH_LIMIT = 50_000;

export async function pruneAiChatPayloads(
  opts: AiChatRetentionOptions,
): Promise<AiChatRetentionResult> {
  const limit = opts.limit ?? DEFAULT_BATCH_LIMIT;
  const cutoff = new Date(Date.now() - opts.days * 24 * 60 * 60 * 1000);

  // Select the batch by primary key first, then update those ids. Postgres has
  // no UPDATE ... LIMIT, and this keeps the row set stable and index-driven.
  const batch = await db
    .select({ id: ai_chats.id })
    .from(ai_chats)
    .where(and(
      lt(ai_chats.date_created, cutoff),
      or(isNotNull(ai_chats.full_prompt), isNotNull(ai_chats.context)),
    ))
    .limit(limit);

  if (batch.length === 0) return { rowsPruned: 0, moreRemaining: false };

  const ids = batch.map((r) => r.id);
  const res = await db.update(ai_chats)
    .set({ full_prompt: null, context: null })
    .where(inArray(ai_chats.id, ids));

  return {
    rowsPruned: res.rowCount ?? ids.length,
    moreRemaining: batch.length === limit,
  };
}
