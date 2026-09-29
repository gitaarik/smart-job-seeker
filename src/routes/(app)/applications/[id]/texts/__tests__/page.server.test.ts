/**
 * Tests for the `createQuestions` bulk-insert form action, and for `reorder`
 * and `resetOrder`.
 *
 * Pure logic — no LLM involved. Covers the guards that protect the
 * `application_questions.question` NOT NULL column, that new questions go in
 * date order, and how a dragged order is written.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAppFindFirst = vi.fn();
const mockQFindMany = vi.fn();
const mockLFindMany = vi.fn();
const mockValues = vi.fn().mockResolvedValue(undefined);
const mockReturning = vi.fn().mockResolvedValue([{ id: 99 }]);
const mockInsert = vi.fn().mockReturnValue({ values: mockValues, returning: mockReturning });
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });
const mockGetSelectedProfileId = vi.fn();

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		query: {
			applications: { findFirst: (...a: unknown[]) => mockAppFindFirst(...a) },
			application_letters: { findMany: (...a: unknown[]) => mockLFindMany(...a) },
			application_questions: { findMany: (...a: unknown[]) => mockQFindMany(...a) }
		},
		insert: (...a: unknown[]) => mockInsert(...a),
		update: (...a: unknown[]) => mockUpdate(...a),
		// The writes inside run against the same mocks, so a test reads them there.
		transaction: (run: (tx: unknown) => Promise<unknown>) =>
			run({ update: (...a: unknown[]) => mockUpdate(...a) })
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((_c: unknown, v: unknown) => v),
	and: vi.fn((...a: unknown[]) => a)
}));

vi.mock('$lib/server/db/schema', () => ({
	applications: { id: 'applications.id', profile_id: 'applications.profile_id' },
	application_letters: { id: 'al.id', application_id: 'al.application_id', sort: 'al.sort' },
	application_questions: {
		id: 'aq.id',
		application_id: 'aq.application_id',
		sort: 'aq.sort'
	}
}));

vi.mock('$lib/server/profile/selected-profile', () => ({
	getSelectedProfileId: (...a: unknown[]) => mockGetSelectedProfileId(...a)
}));

import { actions } from '../+page.server';

function createEvent(
	questions: unknown,
	opts: {
		user?: App.Locals['user'];
		params?: Record<string, string>;
		rawQuestions?: string;
		fills?: unknown;
	} = {}
) {
	const fd = new FormData();
	fd.set(
		'questions',
		opts.rawQuestions !== undefined ? opts.rawQuestions : JSON.stringify(questions)
	);
	if (opts.fills !== undefined) {
		fd.set('fills', typeof opts.fills === 'string' ? opts.fills : JSON.stringify(opts.fills));
	}
	return {
		params: opts.params ?? { id: '1' },
		locals: { user: opts.user === undefined ? { id: 'user-1' } : opts.user },
		cookies: {},
		request: { formData: async () => fd }
	} as unknown as Parameters<NonNullable<typeof actions.createQuestions>>[0];
}

describe('createQuestions action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockValues.mockResolvedValue(undefined);
		mockUpdateWhere.mockResolvedValue(undefined);
		mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
		mockUpdate.mockReturnValue({ set: mockUpdateSet });
		mockGetSelectedProfileId.mockResolvedValue(12);
		mockAppFindFirst.mockResolvedValue({ id: 1, profile_id: 12 });
		mockQFindMany.mockResolvedValue([]);
	});

	it('rejects unauthenticated', async () => {
		const res = await actions.createQuestions!(createEvent([], { user: null }));
		expect(res).toMatchObject({ status: 401 });
	});

	it('rejects when no profile is selected', async () => {
		mockGetSelectedProfileId.mockResolvedValueOnce(null);
		const res = await actions.createQuestions!(createEvent([{ question: 'Q', answer: 'A' }]));
		expect(res).toMatchObject({ status: 400 });
	});

	it('rejects an invalid application id', async () => {
		const res = await actions.createQuestions!(
			createEvent([{ question: 'Q', answer: 'A' }], { params: { id: 'abc' } })
		);
		expect(res).toMatchObject({ status: 400 });
	});

	it('rejects when the application is not found / not owned', async () => {
		mockAppFindFirst.mockResolvedValueOnce(undefined);
		const res = await actions.createQuestions!(createEvent([{ question: 'Q', answer: 'A' }]));
		expect(res).toMatchObject({ status: 404 });
	});

	it('rejects a non-JSON payload', async () => {
		const res = await actions.createQuestions!(createEvent(null, { rawQuestions: '{not json' }));
		expect(res).toMatchObject({ status: 400 });
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it('rejects a payload that is not an array', async () => {
		const res = await actions.createQuestions!(createEvent({ question: 'Q' }));
		expect(res).toMatchObject({ status: 400 });
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it('rejects an empty batch (all rows blank)', async () => {
		const res = await actions.createQuestions!(
			createEvent([
				{ question: '  ', answer: '  ' },
				{ question: '', answer: '' }
			])
		);
		expect(res).toMatchObject({ status: 400 });
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it('rejects the whole batch when any row has an answer but no question', async () => {
		// The NOT NULL guard: never silently drop the user's answer text.
		const res = await actions.createQuestions!(
			createEvent([
				{ question: 'Real question', answer: '' },
				{ question: '', answer: 'an orphaned answer' }
			])
		);
		expect(res).toMatchObject({ status: 400 });
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it('inserts valid rows in pasted order, unplaced and nulling empty answers', async () => {
		const res = await actions.createQuestions!(
			createEvent([
				{ question: 'Q1', answer: 'A1' },
				{ question: 'Q2 (no answer yet)', answer: '   ' }
			])
		);
		expect(res).toMatchObject({ success: true, added: 2 });

		expect(mockInsert).toHaveBeenCalledTimes(1);
		const inserted = mockValues.mock.calls[0][0];
		expect(inserted).toHaveLength(2);
		expect(inserted[0]).toMatchObject({ question: 'Q1', answer: 'A1' });
		expect(inserted[1]).toMatchObject({ question: 'Q2 (no answer yet)', answer: null });
		expect(inserted[0].application_id).toBe(1);
		// No manual place: they go in date order, and one timestamp keeps the
		// set in the order it was pasted.
		expect(inserted.every((row: { sort?: unknown }) => row.sort === undefined)).toBe(true);
		expect(inserted[0].date_created).toBe(inserted[1].date_created);
	});

	it('trims whitespace on questions and answers', async () => {
		await actions.createQuestions!(createEvent([{ question: '  Trimmed?  ', answer: '  yes  ' }]));
		const inserted = mockValues.mock.calls[0][0];
		expect(inserted[0].question).toBe('Trimmed?');
		expect(inserted[0].answer).toBe('yes');
	});

	it("fills an existing question's answer (no inserts)", async () => {
		mockQFindMany.mockResolvedValueOnce([{ id: 42 }]);
		const res = await actions.createQuestions!(
			createEvent([], { fills: [{ id: 42, answer: '  a pasted answer  ' }] })
		);
		expect(res).toMatchObject({ success: true, added: 0, filled: 1 });
		expect(mockInsert).not.toHaveBeenCalled();
		// Answer is trimmed before the update.
		expect(mockUpdateSet).toHaveBeenCalledWith(
			expect.objectContaining({ answer: 'a pasted answer' })
		);
	});

	it('rejects a fill targeting a question not on this application', async () => {
		mockQFindMany.mockResolvedValueOnce([{ id: 7 }]); // 42 not present
		const res = await actions.createQuestions!(
			createEvent([], { fills: [{ id: 42, answer: 'x' }] })
		);
		expect(res).toMatchObject({ status: 400 });
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it('combines adds and fills in one save', async () => {
		mockQFindMany.mockResolvedValueOnce([{ id: 42 }]);
		const res = await actions.createQuestions!(
			createEvent([{ question: 'New Q', answer: 'A' }], { fills: [{ id: 42, answer: 'fill' }] })
		);
		expect(res).toMatchObject({ success: true, added: 1, filled: 1 });
		expect(mockValues).toHaveBeenCalled();
		expect(mockUpdateWhere).toHaveBeenCalled();
	});

	it('drops fills with a blank answer or non-integer id', async () => {
		const res = await actions.createQuestions!(
			createEvent([{ question: 'Q', answer: 'A' }], {
				fills: [
					{ id: 42, answer: '   ' },
					{ id: 'nope', answer: 'y' }
				]
			})
		);
		expect(res).toMatchObject({ success: true, added: 1, filled: 0 });
		// No valid fills → ownership lookup and update are skipped entirely.
		expect(mockQFindMany).not.toHaveBeenCalled();
		expect(mockUpdate).not.toHaveBeenCalled();
	});
});

describe('reorder action', () => {
	function reorderEvent(order: unknown, params: Record<string, string> = { id: '1' }) {
		const fd = new FormData();
		fd.set('order', typeof order === 'string' ? order : JSON.stringify(order));
		return {
			params,
			locals: { user: { id: 'user-1' } },
			cookies: {},
			request: { formData: async () => fd }
		} as unknown as Parameters<NonNullable<typeof actions.reorder>>[0];
	}

	/** What the action wrote, as `key -> sort`, read off the update mocks. */
	function written() {
		return mockUpdate.mock.calls.map(([table], i) => {
			const { sort } = mockUpdateSet.mock.calls[i][0];
			const [id] = mockUpdateWhere.mock.calls[i][0];
			const kind = (table as { id: string }).id === 'al.id' ? 'letter' : 'question';
			return `${kind}:${id}=${sort}`;
		});
	}

	const day = (d: number) => new Date(Date.UTC(2026, 8, d));

	beforeEach(() => {
		vi.clearAllMocks();
		mockUpdateWhere.mockResolvedValue(undefined);
		mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
		mockUpdate.mockReturnValue({ set: mockUpdateSet });
		mockGetSelectedProfileId.mockResolvedValue(12);
		mockAppFindFirst.mockResolvedValue({ id: 1, profile_id: 12 });
		// In date order: question 3 (newest), letter 9, questions 1 and 2 (pasted together).
		mockLFindMany.mockResolvedValue([{ id: 9, sort: null, date_created: day(20) }]);
		mockQFindMany.mockResolvedValue([
			{ id: 1, sort: null, date_created: day(17) },
			{ id: 2, sort: null, date_created: day(17) },
			{ id: 3, sort: null, date_created: day(27) }
		]);
	});

	it('writes every text its place in the dragged order', async () => {
		const res = await actions.reorder!(
			reorderEvent(['question:1', 'question:2', 'letter:9', 'question:3'])
		);
		expect(res).toMatchObject({ success: true });
		expect(written()).toEqual(['question:1=0', 'question:2=1', 'letter:9=2', 'question:3=3']);
	});

	it('moves only the texts a filtered tab showed, leaving the other kind in place', async () => {
		// The Questions tab: the letter was second and stays second.
		await actions.reorder!(reorderEvent(['question:2', 'question:1', 'question:3']));
		expect(written()).toEqual(['question:2=0', 'letter:9=1', 'question:1=2', 'question:3=3']);
	});

	it('keeps a text the posted order does not know about where it is', async () => {
		// A tab opened before question 3 was added.
		await actions.reorder!(reorderEvent(['question:2', 'letter:9', 'question:1']));
		expect(written()).toEqual(['question:3=0', 'question:2=1', 'letter:9=2', 'question:1=3']);
	});

	it("ignores keys that are not this application's texts, and malformed ones", async () => {
		await actions.reorder!(
			reorderEvent([
				'question:999',
				'garbage',
				'question:1',
				'letter:9',
				'question:3',
				'question:2'
			])
		);
		expect(written()).toEqual(['question:1=0', 'letter:9=1', 'question:3=2', 'question:2=3']);
	});

	it('does not touch date_updated, which the list shows as the last edit', async () => {
		await actions.reorder!(reorderEvent(['question:3', 'letter:9', 'question:1', 'question:2']));
		for (const [values] of mockUpdateSet.mock.calls) {
			expect(Object.keys(values)).toEqual(['sort']);
		}
	});

	it('scopes every write to the application', async () => {
		await actions.reorder!(reorderEvent(['question:3', 'letter:9', 'question:1', 'question:2']));
		for (const [where] of mockUpdateWhere.mock.calls) {
			expect(where[1]).toBe(1);
		}
	});

	it('rejects an order that is not a list of keys', async () => {
		for (const order of ['{not json', { a: 1 }, [1, 2]]) {
			const res = await actions.reorder!(reorderEvent(order));
			expect(res).toMatchObject({ status: 400 });
		}
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it("rejects another profile's application", async () => {
		mockAppFindFirst.mockResolvedValueOnce(undefined);
		const res = await actions.reorder!(reorderEvent(['question:1']));
		expect(res).toMatchObject({ status: 404 });
		expect(mockUpdate).not.toHaveBeenCalled();
	});
});

describe('resetOrder action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockUpdateWhere.mockResolvedValue(undefined);
		mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
		mockUpdate.mockReturnValue({ set: mockUpdateSet });
		mockGetSelectedProfileId.mockResolvedValue(12);
		mockAppFindFirst.mockResolvedValue({ id: 1, profile_id: 12 });
	});

	function resetEvent(params: Record<string, string> = { id: '1' }) {
		return {
			params,
			locals: { user: { id: 'user-1' } },
			cookies: {}
		} as unknown as Parameters<NonNullable<typeof actions.resetOrder>>[0];
	}

	it('clears the manual order on both tables, for this application only', async () => {
		const res = await actions.resetOrder!(resetEvent());
		expect(res).toMatchObject({ success: true });
		expect(mockUpdate.mock.calls.map(([table]) => (table as { id: string }).id)).toEqual([
			'al.id',
			'aq.id'
		]);
		expect(mockUpdateSet.mock.calls.map(([values]) => values)).toEqual([
			{ sort: null },
			{ sort: null }
		]);
		expect(mockUpdateWhere.mock.calls.map(([where]) => where)).toEqual([1, 1]);
	});

	it("rejects another profile's application", async () => {
		mockAppFindFirst.mockResolvedValueOnce(undefined);
		const res = await actions.resetOrder!(resetEvent());
		expect(res).toMatchObject({ status: 404 });
		expect(mockUpdate).not.toHaveBeenCalled();
	});
});
