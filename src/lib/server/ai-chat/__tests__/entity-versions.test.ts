/**
 * Unit tests for the shared version-history engine used by application letters
 * and questions. Pure logic over a mocked db — verifies the FK-column keying,
 * the only-if-changed guard, the conversation mapping, and the trim.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

// The engine ends a select on `.where()`, on `.orderBy()`, or on `.limit()`
// depending on the query, so every link has to be both awaitable and chainable.
// Rows come from the *terminal* link's queue, so a chain consumes exactly one.
const mockLimit = vi.fn().mockResolvedValue([]);
const mockOrderByRows = vi.fn().mockResolvedValue([]);
const mockWhereRows = vi.fn().mockResolvedValue([]);
type Resolve = (value: unknown) => void;
const mockOrderBy = vi.fn().mockImplementation(() => ({
	limit: mockLimit,
	then: (res: Resolve, rej: Resolve) => mockOrderByRows().then(res, rej)
}));
const mockSelectWhere = vi.fn().mockImplementation(() => ({
	orderBy: mockOrderBy,
	limit: mockLimit,
	then: (res: Resolve, rej: Resolve) => mockWhereRows().then(res, rej)
}));
const mockFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		insert: (...a: any[]) => mockInsert(...a),
		delete: (...a: any[]) => mockDelete(...a),
		update: (...a: unknown[]) => mockUpdate(...a),
		select: (...a: any[]) => mockSelect(...a)
	}
}));

vi.mock('drizzle-orm', () => ({
	and: (...a: any[]) => ({ and: a }),
	asc: (c: any) => ({ asc: c }),
	desc: (c: unknown) => ({ desc: c }),
	eq: (c: any, v: any) => ({ eq: [c, v] }),
	gt: (c: unknown, v: unknown) => ({ gt: [c, v] }),
	gte: (c: unknown, v: unknown) => ({ gte: [c, v] }),
	isNotNull: (c: unknown) => ({ isNotNull: c })
}));

vi.mock('$lib/server/db/schema', () => ({
	letter_versions: {
		letter: 'lv.letter',
		id: 'lv.id',
		date_created: 'lv.dc',
		content: 'lv.content',
		source: 'lv.source',
		ai_feedback: 'lv.aif',
		user_request: 'lv.ur',
		ai_chat: 'lv.chat'
	},
	question_versions: {
		question: 'qv.question',
		id: 'qv.id',
		date_created: 'qv.dc',
		content: 'qv.content',
		source: 'qv.source',
		ai_feedback: 'qv.aif',
		user_request: 'qv.ur',
		ai_chat: 'qv.chat'
	},
	story_versions: {
		story: 'sv.story',
		id: 'sv.id',
		date_created: 'sv.dc',
		content: 'sv.content',
		source: 'sv.source',
		ai_feedback: 'sv.aif',
		user_request: 'sv.ur',
		ai_chat: 'sv.chat'
	},
	cheat_sheet_versions: {
		cheat_sheet: 'csv.cheat_sheet',
		id: 'csv.id',
		date_created: 'csv.dc',
		content: 'csv.content',
		source: 'csv.source',
		ai_feedback: 'csv.aif',
		user_request: 'csv.ur',
		ai_chat: 'csv.chat'
	}
}));

import {
	buildConversation,
	ensureBaselineVersion,
	LETTER_VERSIONS,
	QUESTION_VERSIONS,
	readVersion,
	recordVersion,
	recordVersionIfChanged,
	deleteVersionEntry,
	trimVersionsAfter,
	trimVersionsFrom
} from '../entity-versions';

describe('entity-versions engine', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockOrderByRows.mockResolvedValue([]);
		mockWhereRows.mockResolvedValue([]);
		mockLimit.mockResolvedValue([]);
	});

	it("keys the insert by the entity's FK column name", async () => {
		await recordVersion(QUESTION_VERSIONS, {
			entityId: 42,
			content: 'hi',
			source: 'manual_edit'
		});
		expect(mockInsertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				question: 42,
				content: 'hi',
				source: 'manual_edit',
				ai_chat: null
			})
		);

		await recordVersion(LETTER_VERSIONS, {
			entityId: 7,
			content: 'yo',
			source: 'ai_generation',
			aiChatId: 3
		});
		expect(mockInsertValues).toHaveBeenLastCalledWith(
			expect.objectContaining({
				letter: 7,
				content: 'yo',
				source: 'ai_generation',
				ai_chat: 3
			})
		);
	});

	it('reads one version only through the entity it hangs off', async () => {
		// The scoping is the whole of this function. Version ids are per TABLE, so
		// a lookup by id alone reaches whatever row that number names — including
		// a version of somebody else's letter. Asserted on the WHERE rather than
		// on the row it returned, because a mock hands back whatever it is given
		// and would pass just as happily without the entity clause.
		mockLimit.mockResolvedValue([
			{ id: 9, content: 'the text', source: 'agent_revision', date_created: null }
		]);

		expect(await readVersion(LETTER_VERSIONS, 7, 9)).toEqual({
			id: 9,
			content: 'the text',
			source: 'agent_revision',
			date: null
		});

		expect(mockSelectWhere).toHaveBeenCalledWith({
			and: [{ eq: ['lv.letter', 7] }, { eq: ['lv.id', 9] }]
		});
	});

	it('answers null for a version the entity does not have', async () => {
		// Not an error and not an empty version: indistinguishable from one that
		// was never there, which is the same answer `readOwnedText` gives for a row
		// outside the profile.
		mockLimit.mockResolvedValue([]);
		expect(await readVersion(QUESTION_VERSIONS, 7, 9)).toBeNull();
	});

	it('records a version only when content changed and is non-empty', async () => {
		// unchanged -> no insert
		expect(
			await recordVersionIfChanged(QUESTION_VERSIONS, {
				entityId: 1,
				newContent: 'same',
				previousContent: 'same',
				source: 'manual_edit'
			})
		).toBe(false);
		// empty new content -> no insert
		expect(
			await recordVersionIfChanged(QUESTION_VERSIONS, {
				entityId: 1,
				newContent: '',
				previousContent: 'old',
				source: 'manual_edit'
			})
		).toBe(false);
		expect(mockInsert).not.toHaveBeenCalled();

		// changed + non-empty -> inserts
		expect(
			await recordVersionIfChanged(QUESTION_VERSIONS, {
				entityId: 1,
				newContent: 'new',
				previousContent: 'old',
				source: 'ai_revision'
			})
		).toBe(true);
		expect(mockInsertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				question: 1,
				content: 'new',
				source: 'ai_revision'
			})
		);
	});

	it('maps version rows into ordered conversation entries', async () => {
		const d = new Date('2026-07-22T10:00:00Z');
		mockOrderByRows.mockResolvedValueOnce([
			{
				id: 5,
				date_created: d,
				content: 'c',
				source: 'ai_review',
				ai_feedback: 'fb',
				user_request: 'req'
			}
		]);
		const convo = await buildConversation(LETTER_VERSIONS, 9);
		expect(convo).toEqual([
			{
				versionId: 5,
				type: 'ai_review',
				content: 'c',
				aiFeedback: 'fb',
				userRequest: 'req',
				date: d
			}
		]);
	});

	it('trims versions after a given id and reports what survives', async () => {
		mockLimit.mockResolvedValueOnce([{ content: 'v1' }]);
		const { remainingContent } = await trimVersionsAfter(QUESTION_VERSIONS, 3, 10);
		expect(mockDelete).toHaveBeenCalledTimes(1);
		expect(mockDeleteWhere).toHaveBeenCalledWith({
			and: [{ eq: ['qv.question', 3] }, { gt: ['qv.id', 10] }]
		});
		// The rewound-onto version, so a save that changes nothing records nothing.
		expect(remainingContent).toBe('v1');
	});

	describe('trimVersionsFrom', () => {
		it('reports the newest surviving thread pointer, skipping rows without one', async () => {
			mockLimit
				.mockResolvedValueOnce([{ id: 12, source: 'ai_revision' }]) // target
				.mockResolvedValueOnce([{ ai_chat: 88 }]) // latest ai_chat
				.mockResolvedValueOnce([{ content: 'v2' }]); // latest content
			const res = await trimVersionsFrom(LETTER_VERSIONS, 4, 12);
			expect(res).toEqual({
				existed: true,
				removedSource: 'ai_revision',
				aiChatId: 88,
				remainingContent: 'v2'
			});
			// The ai_chat lookup filters out rows that carry none — a manual save
			// records a version with no chat, and taking its null would reset the
			// editor to its pre-thread state with the conversation still on screen.
			expect(mockSelectWhere).toHaveBeenCalledWith(
				expect.objectContaining({
					and: expect.arrayContaining([{ isNotNull: 'lv.chat' }])
				})
			);
		});

		it('reports a missing target without deleting anything', async () => {
			mockLimit.mockResolvedValueOnce([]);
			const res = await trimVersionsFrom(QUESTION_VERSIONS, 4, 99);
			expect(res.existed).toBe(false);
			expect(mockDelete).not.toHaveBeenCalled();
		});
	});

	describe('deleteVersionEntry', () => {
		it("drops the whole turn and rewinds the entity when it held the deleted version's text", async () => {
			mockLimit
				.mockResolvedValueOnce([{ user_request: 'make it shorter' }]) // target
				.mockResolvedValueOnce([{ ai_chat: 5 }])
				.mockResolvedValueOnce([{ content: 'older' }]);
			mockWhereRows.mockResolvedValueOnce([{ content: 'the live answer' }]);

			const res = await deleteVersionEntry(QUESTION_VERSIONS, 7, 20, {
				scope: 'turn',
				committedContent: 'the live answer'
			});

			expect(res).toEqual({
				existed: true,
				keptMessage: false,
				aiChatId: 5,
				liveContent: 'older',
				rewind: true
			});
			// A whole-turn delete removes the row itself, so the bound is inclusive.
			expect(mockDeleteWhere).toHaveBeenCalledWith({
				and: [{ eq: ['qv.question', 7] }, { gte: ['qv.id', 20] }]
			});
			expect(mockUpdate).not.toHaveBeenCalled();
		});

		it("keeps the applicant's message on scope 'response' and clears the reply", async () => {
			mockLimit
				.mockResolvedValueOnce([{ user_request: 'make it shorter' }])
				.mockResolvedValueOnce([{ ai_chat: 5 }])
				.mockResolvedValueOnce([{ content: 'older' }]);
			mockWhereRows.mockResolvedValueOnce([{ content: 'the live answer' }]);

			const res = await deleteVersionEntry(QUESTION_VERSIONS, 7, 20, {
				scope: 'response',
				committedContent: 'the live answer'
			});

			expect(res.keptMessage).toBe(true);
			// Only what came *after* is deleted; the turn itself is emptied in place.
			expect(mockDeleteWhere).toHaveBeenCalledWith({
				and: [{ eq: ['qv.question', 7] }, { gt: ['qv.id', 20] }]
			});
			// Its chat goes with the reply, so the next message chains from the
			// parent turn rather than the response that was just thrown away.
			expect(mockUpdateSet).toHaveBeenCalledWith({
				content: null,
				ai_feedback: null,
				ai_chat: null
			});
		});

		it('falls back to a whole-turn delete when there is no message to keep', async () => {
			mockLimit
				.mockResolvedValueOnce([{ user_request: null }])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([]);
			mockWhereRows.mockResolvedValueOnce([{ content: null }]);

			const res = await deleteVersionEntry(QUESTION_VERSIONS, 7, 20, {
				scope: 'response',
				committedContent: null
			});

			// The advice turn that started a thread: nothing of the applicant's to
			// preserve, so 'response' and 'turn' are the same delete, and the empty
			// trail hands back a null pointer that resets the editor.
			expect(res).toEqual({
				existed: true,
				keptMessage: false,
				aiChatId: null,
				liveContent: null,
				rewind: false
			});
			expect(mockUpdate).not.toHaveBeenCalled();
		});

		it('leaves a deliberately picked older version alone', async () => {
			mockLimit
				.mockResolvedValueOnce([{ user_request: null }])
				.mockResolvedValueOnce([{ ai_chat: 5 }])
				.mockResolvedValueOnce([{ content: 'v3' }]);
			mockWhereRows.mockResolvedValueOnce([{ content: 'v4' }]);

			const res = await deleteVersionEntry(LETTER_VERSIONS, 7, 20, {
				scope: 'turn',
				// "Use as letter" put v2 in the entity; deleting v4 must not move it.
				committedContent: 'v2'
			});
			expect(res.rewind).toBe(false);
		});

		it('reports a missing entry without touching the trail', async () => {
			mockLimit.mockResolvedValueOnce([]);
			const res = await deleteVersionEntry(QUESTION_VERSIONS, 7, 999, {
				scope: 'turn',
				committedContent: null
			});
			expect(res.existed).toBe(false);
			expect(mockDelete).not.toHaveBeenCalled();
		});
	});

	describe('ensureBaselineVersion', () => {
		it('inserts a baseline when content exists and there are no versions yet', async () => {
			mockLimit.mockResolvedValueOnce([]); // no existing versions
			await ensureBaselineVersion(QUESTION_VERSIONS, 5, 'original answer');
			expect(mockInsertValues).toHaveBeenCalledWith(
				expect.objectContaining({
					question: 5,
					content: 'original answer',
					source: 'manual_edit'
				})
			);
		});

		it('does nothing when a version already exists', async () => {
			mockLimit.mockResolvedValueOnce([{ id: 1 }]); // a version is already present
			await ensureBaselineVersion(LETTER_VERSIONS, 9, 'already versioned');
			expect(mockInsert).not.toHaveBeenCalled();
		});

		it('does nothing (and does not query) when there is no content', async () => {
			await ensureBaselineVersion(QUESTION_VERSIONS, 5, null);
			expect(mockSelect).not.toHaveBeenCalled();
			expect(mockInsert).not.toHaveBeenCalled();
		});
	});
});
