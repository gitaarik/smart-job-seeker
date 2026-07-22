/**
 * Shared version-history engine for application texts.
 *
 * Application letters and questions both keep an append-only version trail
 * (letter_versions / question_versions) and reconstruct an ordered thread from
 * it. The two tables are identical apart from the FK column name (`letter` vs
 * `question`), so this module centralizes the record/build/trim logic behind a
 * small binding, and both entities use it instead of hand-rolling their own.
 *
 * The tables' generic Drizzle types don't compose cleanly through a runtime
 * table object, so the binding is intentionally loosely typed (`any` columns)
 * and the values object is cast at the single insert site — the surface is tiny
 * and covered by unit tests.
 */
import { dbDirect as db } from "$lib/server/db";
import { and, asc, desc, eq, gt, gte } from "drizzle-orm";
import { letter_versions, question_versions } from "$lib/server/db/schema";

/** Provenance of a version. Plain varchar in the DB; enforced here in TS. */
export type VersionSource =
  | "manual_edit"
  | "ai_generation"
  | "ai_revision"
  | "ai_review"
  | "ai_advice";

/** One entry in the reconstructed thread the editor renders. */
export type ConversationEntry = {
  versionId: number;
  type: VersionSource;
  content?: string | null;
  aiFeedback?: string | null;
  userRequest?: string | null;
  date: Date | null;
};

/** Binds the engine to one entity's versions table. */
type VersionBinding = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fk: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  id: any;
  /** FK column property name, used to key the insert values object. */
  fkName: "letter" | "question";
};

export const LETTER_VERSIONS: VersionBinding = {
  table: letter_versions,
  fk: letter_versions.letter,
  id: letter_versions.id,
  fkName: "letter",
};

export const QUESTION_VERSIONS: VersionBinding = {
  table: question_versions,
  fk: question_versions.question,
  id: question_versions.id,
  fkName: "question",
};

/** Reconstruct the ordered (oldest→newest) thread from the versions table. */
export async function buildConversation(
  vt: VersionBinding,
  entityId: number,
): Promise<ConversationEntry[]> {
  const rows = await db
    .select({
      id: vt.id,
      date_created: vt.table.date_created,
      content: vt.table.content,
      source: vt.table.source,
      ai_feedback: vt.table.ai_feedback,
      user_request: vt.table.user_request,
    })
    .from(vt.table)
    .where(eq(vt.fk, entityId))
    .orderBy(asc(vt.id));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.map((v: any) => ({
    versionId: v.id,
    type: v.source as VersionSource,
    content: v.content,
    aiFeedback: v.ai_feedback,
    userRequest: v.user_request,
    date: v.date_created,
  }));
}

/** Unconditional insert of a version row. */
export async function recordVersion(
  vt: VersionBinding,
  v: {
    entityId: number;
    content: string | null;
    source: VersionSource;
    aiChatId?: number | null;
    aiFeedback?: string | null;
    userRequest?: string | null;
  },
): Promise<void> {
  await db.insert(vt.table).values({
    [vt.fkName]: v.entityId,
    content: v.content,
    source: v.source,
    ai_chat: v.aiChatId ?? null,
    ai_feedback: v.aiFeedback ?? null,
    user_request: v.userRequest ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

/**
 * Record a version only when the content actually changed, and only when
 * there's content to record. Returns whether a row was written.
 */
export async function recordVersionIfChanged(
  vt: VersionBinding,
  v: {
    entityId: number;
    newContent: string | null;
    previousContent: string | null;
    source: VersionSource;
    aiChatId?: number | null;
  },
): Promise<boolean> {
  const changed = (v.newContent || null) !== (v.previousContent || null);
  if (!changed || !v.newContent) return false;
  await recordVersion(vt, {
    entityId: v.entityId,
    content: v.newContent,
    source: v.source,
    aiChatId: v.aiChatId ?? null,
  });
  return true;
}

/** Delete versions strictly AFTER a given id (rollback-then-save trim). */
export async function trimVersionsAfter(
  vt: VersionBinding,
  entityId: number,
  afterId: number,
): Promise<void> {
  await db.delete(vt.table).where(and(eq(vt.fk, entityId), gt(vt.id, afterId)));
}

/**
 * Delete a version AND everything after it (revert-to-before-this-version).
 * Reports whether the target existed and returns the last remaining version's
 * ai_chat pointer + content, so the caller can restore the entity's ai_chat
 * reference. Used by the "replace this version" followup path.
 */
export async function trimVersionsFrom(
  vt: VersionBinding,
  entityId: number,
  fromId: number,
): Promise<{
  existed: boolean;
  last: { ai_chat: number | null; content: string | null } | null;
}> {
  const target = await db
    .select({ id: vt.id })
    .from(vt.table)
    .where(and(eq(vt.fk, entityId), eq(vt.id, fromId)))
    .limit(1);
  if (target.length === 0) return { existed: false, last: null };

  await db.delete(vt.table).where(and(eq(vt.fk, entityId), gte(vt.id, fromId)));

  const last = await db
    .select({ ai_chat: vt.table.ai_chat, content: vt.table.content })
    .from(vt.table)
    .where(eq(vt.fk, entityId))
    .orderBy(desc(vt.id))
    .limit(1);
  return { existed: true, last: last[0] ?? null };
}
