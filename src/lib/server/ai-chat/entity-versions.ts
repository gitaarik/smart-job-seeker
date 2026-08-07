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
import { dbDirect as db } from '$lib/server/db';
import { and, asc, desc, eq, gt, gte, lt } from 'drizzle-orm';
import {
	cheat_sheet_versions,
	letter_versions,
	question_versions,
	story_versions
} from '$lib/server/db/schema';

/** Provenance of a version. Plain varchar in the DB; enforced here in TS. */
export type VersionSource =
	'manual_edit' | 'ai_generation' | 'ai_revision' | 'ai_review' | 'ai_advice';

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
export type VersionBinding = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	table: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	fk: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	id: any;
	/** FK column property name, used to key the insert values object. */
	fkName: 'letter' | 'question' | 'story' | 'cheat_sheet';
};

export const LETTER_VERSIONS: VersionBinding = {
	table: letter_versions,
	fk: letter_versions.letter,
	id: letter_versions.id,
	fkName: 'letter'
};

export const QUESTION_VERSIONS: VersionBinding = {
	table: question_versions,
	fk: question_versions.question,
	id: question_versions.id,
	fkName: 'question'
};

export const STORY_VERSIONS: VersionBinding = {
	table: story_versions,
	fk: story_versions.story,
	id: story_versions.id,
	fkName: 'story'
};

export const CHEATSHEET_VERSIONS: VersionBinding = {
	table: cheat_sheet_versions,
	fk: cheat_sheet_versions.cheat_sheet,
	id: cheat_sheet_versions.id,
	fkName: 'cheat_sheet'
};

/** Reconstruct the ordered (oldest→newest) thread from the versions table. */
export async function buildConversation(
	vt: VersionBinding,
	entityId: number
): Promise<ConversationEntry[]> {
	const rows = await db
		.select({
			id: vt.id,
			date_created: vt.table.date_created,
			content: vt.table.content,
			source: vt.table.source,
			ai_feedback: vt.table.ai_feedback,
			user_request: vt.table.user_request
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
		date: v.date_created
	}));
}

/**
 * Ensure an entity that already holds content — created before the version
 * trail existed — has a baseline version row, so the first AI/save turn does
 * not become the *only* version and hide the user's original text. No-op when
 * there is no content, or when any version already exists (guarded by count).
 * Call this before recording an AI/manual version on a pre-existing entity.
 */
export async function ensureBaselineVersion(
	vt: VersionBinding,
	entityId: number,
	existingContent: string | null
): Promise<void> {
	if (!existingContent) return;
	const existing = await db
		.select({ id: vt.id })
		.from(vt.table)
		.where(eq(vt.fk, entityId))
		.limit(1);
	if (existing.length > 0) return;
	await recordVersion(vt, {
		entityId,
		content: existingContent,
		source: 'manual_edit'
	});
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
	}
): Promise<void> {
	await db.insert(vt.table).values({
		[vt.fkName]: v.entityId,
		content: v.content,
		source: v.source,
		ai_chat: v.aiChatId ?? null,
		ai_feedback: v.aiFeedback ?? null,
		user_request: v.userRequest ?? null
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
	}
): Promise<boolean> {
	const changed = (v.newContent || null) !== (v.previousContent || null);
	if (!changed || !v.newContent) return false;
	await recordVersion(vt, {
		entityId: v.entityId,
		content: v.newContent,
		source: v.source,
		aiChatId: v.aiChatId ?? null
	});
	return true;
}

/**
 * "Delete the AI response, keep the message": null out a turn's content and
 * ai_feedback (keeping its user_request), and remove any later versions so this
 * turn's message becomes the latest again. Returns the prior version's ai_chat
 * so the caller can restore the entity's live thread pointer, so a later message
 * chains from the right parent (not the discarded response). Used by the
 * per-turn "delete response" affordance.
 */
export async function clearVersionContent(
	vt: VersionBinding,
	entityId: number,
	versionId: number
): Promise<{ existed: boolean; priorAiChat: number | null }> {
	const target = await db
		.select({ id: vt.id })
		.from(vt.table)
		.where(and(eq(vt.fk, entityId), eq(vt.id, versionId)))
		.limit(1);
	if (target.length === 0) return { existed: false, priorAiChat: null };

	// Rewind: drop everything recorded after this turn.
	await db.delete(vt.table).where(and(eq(vt.fk, entityId), gt(vt.id, versionId)));

	// Drop the AI response, keep the user's message.
	await db
		.update(vt.table)
		.set({ content: null, ai_feedback: null })
		.where(and(eq(vt.fk, entityId), eq(vt.id, versionId)));

	// The prior version's chat becomes the live thread again.
	const prior = await db
		.select({ ai_chat: vt.table.ai_chat })
		.from(vt.table)
		.where(and(eq(vt.fk, entityId), lt(vt.id, versionId)))
		.orderBy(desc(vt.id))
		.limit(1);
	return { existed: true, priorAiChat: prior[0]?.ai_chat ?? null };
}

/** Delete versions strictly AFTER a given id (rollback-then-save trim). */
export async function trimVersionsAfter(
	vt: VersionBinding,
	entityId: number,
	afterId: number
): Promise<void> {
	await db.delete(vt.table).where(and(eq(vt.fk, entityId), gt(vt.id, afterId)));
}

/**
 * Delete a version AND everything after it (revert-to-before-this-version).
 * Reports whether the target existed and returns the last remaining version's
 * ai_chat pointer + content, so the caller can restore the entity's ai_chat
 * reference. Used by the "replace this version" followup path.
 *
 * Also reports the removed row's `source`: when the trim leaves nothing behind
 * there is no thread to follow up on, and the caller has to restart the same
 * *kind* of turn from scratch (see the followup endpoints' restart path).
 */
export async function trimVersionsFrom(
	vt: VersionBinding,
	entityId: number,
	fromId: number
): Promise<{
	existed: boolean;
	removedSource: VersionSource | null;
	last: { ai_chat: number | null; content: string | null } | null;
}> {
	const target = await db
		.select({ id: vt.id, source: vt.table.source })
		.from(vt.table)
		.where(and(eq(vt.fk, entityId), eq(vt.id, fromId)))
		.limit(1);
	if (target.length === 0) {
		return { existed: false, removedSource: null, last: null };
	}

	await db.delete(vt.table).where(and(eq(vt.fk, entityId), gte(vt.id, fromId)));

	const last = await db
		.select({ ai_chat: vt.table.ai_chat, content: vt.table.content })
		.from(vt.table)
		.where(eq(vt.fk, entityId))
		.orderBy(desc(vt.id))
		.limit(1);
	return {
		existed: true,
		removedSource: (target[0].source as VersionSource) ?? null,
		last: last[0] ?? null
	};
}

/**
 * Per-turn "delete this AI response". If the turn carries a user message, keep
 * the message (clearVersionContent) so it can be regenerated. Otherwise — a
 * message-less first draft or standalone review — delete it and everything
 * after, rewinding to the last remaining version. Returns what the caller
 * should write to the entity: the live ai_chat pointer, and, for a full delete,
 * the content the committed field (answer/content) should rewind to (null =
 * clear, back to the empty state). `keptMessage` tells the caller whether to
 * leave the committed field alone (message kept) or rewind it (full delete).
 */
export async function deleteResponse(
	vt: VersionBinding,
	entityId: number,
	versionId: number
): Promise<{
	existed: boolean;
	keptMessage: boolean;
	aiChatId: number | null;
	liveContent: string | null;
}> {
	const rows = await db
		.select({ user_request: vt.table.user_request })
		.from(vt.table)
		.where(and(eq(vt.fk, entityId), eq(vt.id, versionId)))
		.limit(1);
	if (rows.length === 0) {
		return {
			existed: false,
			keptMessage: false,
			aiChatId: null,
			liveContent: null
		};
	}
	if (rows[0].user_request) {
		const { priorAiChat } = await clearVersionContent(vt, entityId, versionId);
		return {
			existed: true,
			keptMessage: true,
			aiChatId: priorAiChat,
			liveContent: null
		};
	}
	const { last } = await trimVersionsFrom(vt, entityId, versionId);
	return {
		existed: true,
		keptMessage: false,
		aiChatId: last?.ai_chat ?? null,
		liveContent: last?.content ?? null
	};
}
