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
import { and, asc, desc, eq, gt, gte, isNotNull } from 'drizzle-orm';
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
 * The thread pointer an entity should hold given the rows that remain: the
 * newest `ai_chat` in the trail, skipping rows that carry none.
 *
 * Skipping matters. A manual save records a version with a null `ai_chat`, so
 * "the last row's chat" is null whenever the applicant typed their own version
 * last — which would reset the editor to its pre-thread state and lose a
 * conversation that is still sitting on screen. It is also how a kept message
 * drops out of the reckoning: its own chat is nulled with the reply it lost.
 */
async function latestAiChat(vt: VersionBinding, entityId: number): Promise<number | null> {
	const rows = await db
		.select({ ai_chat: vt.table.ai_chat })
		.from(vt.table)
		.where(and(eq(vt.fk, entityId), isNotNull(vt.table.ai_chat)))
		.orderBy(desc(vt.id))
		.limit(1);
	return rows[0]?.ai_chat ?? null;
}

/** Newest remaining content in the trail — null when nothing is left. */
async function latestContent(vt: VersionBinding, entityId: number): Promise<string | null> {
	const rows = await db
		.select({ content: vt.table.content })
		.from(vt.table)
		.where(and(eq(vt.fk, entityId), isNotNull(vt.table.content)))
		.orderBy(desc(vt.id))
		.limit(1);
	return rows[0]?.content ?? null;
}

/**
 * Delete versions strictly AFTER a given id (rollback-then-save trim). Returns
 * the newest content that survives, which is what the saved edit should be
 * compared against — comparing it to the entity's committed value instead would
 * record a redundant duplicate whenever the applicant rewinds to an older
 * version and saves it unchanged.
 */
export async function trimVersionsAfter(
	vt: VersionBinding,
	entityId: number,
	afterId: number
): Promise<{ remainingContent: string | null }> {
	await db.delete(vt.table).where(and(eq(vt.fk, entityId), gt(vt.id, afterId)));
	return { remainingContent: await latestContent(vt, entityId) };
}

/**
 * Delete a version AND everything after it (revert-to-before-this-version).
 * Reports whether the target existed, the thread pointer that survives it, and
 * the newest content left behind, so the caller can restore the entity's
 * `ai_chat` reference. Used by the "replace this version" followup path.
 *
 * Also reports the removed row's `source`: when the trim leaves no thread
 * behind there is nothing to follow up on, and the caller has to restart the
 * same *kind* of turn from scratch (see the followup endpoints' restart path).
 */
export async function trimVersionsFrom(
	vt: VersionBinding,
	entityId: number,
	fromId: number
): Promise<{
	existed: boolean;
	removedSource: VersionSource | null;
	aiChatId: number | null;
	remainingContent: string | null;
}> {
	const target = await db
		.select({ id: vt.id, source: vt.table.source })
		.from(vt.table)
		.where(and(eq(vt.fk, entityId), eq(vt.id, fromId)))
		.limit(1);
	if (target.length === 0) {
		return { existed: false, removedSource: null, aiChatId: null, remainingContent: null };
	}

	await db.delete(vt.table).where(and(eq(vt.fk, entityId), gte(vt.id, fromId)));

	return {
		existed: true,
		removedSource: (target[0].source as VersionSource) ?? null,
		aiChatId: await latestAiChat(vt, entityId),
		remainingContent: await latestContent(vt, entityId)
	};
}

/** How much of a turn a delete takes with it. */
export type DeleteScope =
	/** Drop the AI's reply and keep the applicant's message, so it can be resent. */
	| 'response'
	/** Drop the whole turn, message included. */
	| 'turn';

export type DeleteOutcome = {
	existed: boolean;
	/** Whether the turn's message survived — the entry stays, empty of a reply. */
	keptMessage: boolean;
	/** The thread pointer the entity should now hold (null = no thread left). */
	aiChatId: number | null;
	/** The newest content left in the trail, for a caller that has to rewind. */
	liveContent: string | null;
	/**
	 * Whether the entity's committed field (answer / content / STAR columns) has
	 * to be rewound to `liveContent`. True only when what it holds was one of the
	 * versions this delete removed — a deliberate "use as answer" pick of some
	 * *other* version is not disturbed by a delete further down the thread.
	 */
	rewind: boolean;
};

/**
 * Delete one entry from a version trail, rewinding the thread to just before it.
 *
 * The trail is linear — the editor renders it as one conversation and every
 * later turn was written in reply to this one — so a delete always takes
 * everything after it too. `scope` decides only how much of the *target* turn
 * goes: `'response'` empties it of the AI's reply and its version while keeping
 * the applicant's message as the new tail (edit it, send again), `'turn'`
 * removes the row outright. A turn with no message of its own can only be
 * deleted whole, so `'response'` falls back to `'turn'` there.
 *
 * `committedContent` is what the entity currently shows as its live text; it is
 * only used to decide `rewind` (see DeleteOutcome).
 */
export async function deleteVersionEntry(
	vt: VersionBinding,
	entityId: number,
	versionId: number,
	opts: { scope: DeleteScope; committedContent: string | null }
): Promise<DeleteOutcome> {
	const target = await db
		.select({ user_request: vt.table.user_request })
		.from(vt.table)
		.where(and(eq(vt.fk, entityId), eq(vt.id, versionId)))
		.limit(1);
	if (target.length === 0) {
		return { existed: false, keptMessage: false, aiChatId: null, liveContent: null, rewind: false };
	}

	// Read what is about to disappear before it does, so the caller can tell
	// whether the entity's live text was one of these versions.
	const removed = await db
		.select({ content: vt.table.content })
		.from(vt.table)
		.where(and(eq(vt.fk, entityId), gte(vt.id, versionId)));

	const keptMessage = opts.scope === 'response' && !!target[0].user_request;

	if (keptMessage) {
		await db.delete(vt.table).where(and(eq(vt.fk, entityId), gt(vt.id, versionId)));
		// The message stays; the reply, its version and the chat that produced it
		// go, so the next send chains from the parent turn rather than the
		// discarded one.
		await db
			.update(vt.table)
			.set({ content: null, ai_feedback: null, ai_chat: null })
			.where(and(eq(vt.fk, entityId), eq(vt.id, versionId)));
	} else {
		await db.delete(vt.table).where(and(eq(vt.fk, entityId), gte(vt.id, versionId)));
	}

	const committed = opts.committedContent;
	return {
		existed: true,
		keptMessage,
		aiChatId: await latestAiChat(vt, entityId),
		liveContent: await latestContent(vt, entityId),
		rewind: !!committed && removed.some((r) => r.content === committed)
	};
}
