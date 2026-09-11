import { describe, expect, it } from 'vitest';
import {
	crowdedOut,
	lookedAndFoundNothing,
	mentionsFor,
	type RetrievalItem,
	type RetrievalRecord
} from './retrieval-record';

const item = (over: Partial<RetrievalItem> = {}): RetrievalItem => ({
	source: 'projects',
	kind: 'side_project',
	id: 7,
	title: 'Acme migration',
	context: 'at Acme Corp',
	score: 0.61,
	via: 'semantic',
	...over
});

const record = (over: Partial<RetrievalRecord> = {}): RetrievalRecord => ({
	requested: ['projects'],
	used: ['projects'],
	dropped: [],
	empty: [],
	chars: { projects: 120 },
	profileChars: 34000,
	budgetChars: 24000,
	rankers: { projects: 'semantic' },
	items: [item()],
	...over
});

describe('mentionsFor', () => {
	it('keeps what names a thing and drops what measures it', () => {
		// The applicant-facing half of the record. A cosine of 0.61 tells someone
		// deciding whether the draft leaned on the right project nothing at all;
		// the project's name tells them everything.
		expect(mentionsFor(record())).toEqual([
			{
				kind: 'side_project',
				id: 7,
				title: 'Acme migration',
				context: 'at Acme Corp'
			}
		]);
	});

	it('omits absent optionals rather than emitting undefined ones', () => {
		const m = mentionsFor(record({ items: [item({ context: undefined })] }));
		expect(m[0]).toEqual({ kind: 'side_project', id: 7, title: 'Acme migration' });
	});

	it('carries the parent id a two-id route needs', () => {
		// A work-experience project lives at /work-experience/[id]/projects/[pid];
		// without the first half the UI can name it but not link it.
		const m = mentionsFor(
			record({ items: [item({ kind: 'work_experience_project', id: 5, parentId: 8 })] })
		);
		expect(m[0]).toMatchObject({ kind: 'work_experience_project', id: 5, parentId: 8 });
	});

	it('has nothing to say about a turn that never retrieved', () => {
		expect(mentionsFor(null)).toEqual([]);
		expect(mentionsFor(undefined)).toEqual([]);
	});
});

describe('lookedAndFoundNothing', () => {
	it('is true only when a ranker ran and returned nobody', () => {
		// The distinction the whole record exists to keep: "we searched your
		// profile and nothing fit" is worth saying out loud, and is what an
		// items-length check alone would render as silence.
		expect(lookedAndFoundNothing(record({ items: [], rankers: { projects: 'semantic' } }))).toBe(
			true
		);
	});

	it('is false when something was found', () => {
		expect(lookedAndFoundNothing(record())).toBe(false);
	});

	it('is false when no ranked source ran at all', () => {
		// A scoped-sources-only generation (review, revise) retrieves nothing and
		// must not claim an empty profile.
		expect(lookedAndFoundNothing(record({ items: [], rankers: {} }))).toBe(false);
		expect(lookedAndFoundNothing(null)).toBe(false);
	});

	it('is false when the picks existed and the budget ate them', () => {
		// Measured on application 73: a 21.6k-char job description filled the 24k
		// evidence budget by itself and all three ranked sources were dropped
		// after finding nine real matches. Calling that "nothing matched" states
		// the opposite of what happened and sends the applicant off to write
		// material they already have.
		const crowded = record({
			items: [],
			used: ['job'],
			dropped: ['projects', 'stories', 'application_texts'],
			rankers: { projects: 'semantic', stories: 'semantic', application_texts: 'semantic' }
		});
		expect(lookedAndFoundNothing(crowded)).toBe(false);
		expect(crowdedOut(crowded)).toEqual(['projects', 'stories', 'application_texts']);
	});
});

describe('crowdedOut', () => {
	it('counts only sources that rank, not every dropped block', () => {
		// application_activity is scoped, not ranked: it can be dropped for budget
		// too, and that says nothing about whether retrieval found anything.
		const r = record({
			items: [],
			dropped: ['application_activity', 'stories'],
			rankers: { stories: 'semantic' }
		});
		expect(crowdedOut(r)).toEqual(['stories']);
	});

	it('is empty for a turn with no record', () => {
		expect(crowdedOut(null)).toEqual([]);
	});
});
