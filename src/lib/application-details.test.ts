import { describe, expect, it } from 'vitest';
import {
	coerceDetails,
	coerceEntryFacts,
	getDetailCategoryLabel,
	groupDetails,
	PRIVATE_DETAIL_CATEGORIES,
	type StoredDetail
} from './application-details';

/**
 * Typed as STORED rather than as a validated detail, because both sides of this
 * module take loose input: `coerceDetails` reads whatever a model returned, and
 * `groupDetails` reads rows a previous vocabulary wrote.
 */
const detail = (over: Partial<Record<keyof StoredDetail, unknown>> = {}): StoredDetail =>
	({
		category: 'requirement',
		label: 'Office days',
		value: 'Tuesdays and Thursdays, in Amsterdam',
		record_id: null,
		...over
	}) as StoredDetail;

describe('coerceDetails', () => {
	it('is empty for anything that is not a list', () => {
		expect(coerceDetails(null)).toEqual([]);
		expect(coerceDetails({ details: [] })).toEqual([]);
		expect(coerceDetails('Office days: Tue/Thu')).toEqual([]);
	});

	it('keeps a well-formed detail', () => {
		expect(coerceDetails([detail()])).toEqual([
			{
				category: 'requirement',
				label: 'Office days',
				value: 'Tuesdays and Thursdays, in Amsterdam',
				record_id: null
			}
		]);
	});

	it('drops a detail missing either half', () => {
		// A label with no value says a topic came up and refuses to say what was
		// said, which reads as data loss rather than as an absence.
		expect(coerceDetails([detail({ value: '  ' })])).toEqual([]);
		expect(coerceDetails([detail({ label: null })])).toEqual([]);
	});

	it('normalises an unknown category rather than dropping the detail', () => {
		const [d] = coerceDetails([detail({ category: 'vibes' })]);
		expect(d.category).toBe('other');
		expect(d.value).toContain('Amsterdam');
	});

	it('accepts a category in the wrong case', () => {
		expect(coerceDetails([detail({ category: 'Requirement' })])[0].category).toBe('requirement');
	});

	it('keeps a citation only when the entry was actually shown', () => {
		// A cited entry outside the set the model was given is a hallucinated
		// citation, and pointing at the wrong entry is worse than pointing at none.
		expect(coerceDetails([detail({ record_id: 42 })], [42, 43])[0].record_id).toBe(42);
		expect(coerceDetails([detail({ record_id: 99 })], [42, 43])[0].record_id).toBeNull();
		expect(coerceDetails([detail({ record_id: 42 })], [])[0].record_id).toBeNull();
	});

	it('accepts a citation returned as a string', () => {
		expect(coerceDetails([detail({ record_id: '42' })], [42])[0].record_id).toBe(42);
	});

	it('collapses the same detail said twice', () => {
		const twice = [detail({ record_id: 1 }), detail({ label: 'office days', record_id: 2 })];
		const out = coerceDetails(twice, [1, 2]);
		expect(out).toHaveLength(1);
		expect(out[0].record_id).toBe(1);
	});

	it('keeps the same label under a different category', () => {
		const out = coerceDetails([detail(), detail({ category: 'role_detail' })]);
		expect(out).toHaveLength(2);
	});

	it('truncates rather than dropping an over-long value', () => {
		const [d] = coerceDetails([detail({ value: 'x'.repeat(500) })]);
		expect(d.value.length).toBeLessThanOrEqual(301);
		expect(d.value.endsWith('…')).toBe(true);
	});

	it("collapses whitespace so a pasted line break doesn't reflow the card", () => {
		expect(coerceDetails([detail({ value: 'two   days\n\na week' })])[0].value).toBe(
			'two days a week'
		);
	});

	it('keeps a decision the applicant wrote down, even past the cap', () => {
		// A long contract yields a dozen facts on its own. The walk-away number in
		// their notes is recorded nowhere else, so it must not be what the cap cuts.
		const facts = Array.from({ length: 14 }, (_, i) => detail({ label: `Term ${i}` }));
		const decision = detail({
			category: 'decision',
			label: 'Walk-away',
			value: 'An offer elsewhere wins from 95k a year; below 80k it is not worth leaving'
		});
		const out = coerceDetails([...facts, decision]);
		expect(out).toHaveLength(12);
		expect(out[0]).toMatchObject({ category: 'decision', label: 'Walk-away' });
	});

	// A title filed as a person repeats the next step and takes one of the three
	// places the people have.
	it('keeps people labelled by name, not by title', () => {
		const people = ['CPTO of Acme', 'The recruiter', 'A partner', 'HR team', 'Yana', 'Ann Lee'].map(
			(label) => detail({ category: 'people', label, value: 'Runs the first round' })
		);
		expect(coerceDetails(people).map((d) => d.label)).toEqual(['Yana', 'Ann Lee']);
		// Only people: a requirement may start however it likes.
		expect(coerceDetails([detail({ label: 'The office days' })])).toHaveLength(1);
	});

	it('accepts decision as a category rather than folding it into other', () => {
		expect(coerceDetails([detail({ category: 'decision' })])[0].category).toBe('decision');
	});

	// The model lists details in entry order, so the newest entry's come last,
	// and that is where what comes next is said. Measured: fourteen details for
	// twelve places, and the cut took the interviewer and the format of the
	// round that had just been booked.
	it('keeps the next step past the cap, after the decisions', () => {
		const facts = Array.from({ length: 14 }, (_, i) => detail({ label: `Term ${i}` }));
		const next = detail({
			category: 'next_step',
			label: 'First round',
			value: 'Intro with Jane Doe, CTO, on 2026-10-08 at 15:30'
		});
		const decision = detail({ category: 'decision', label: 'Walk-away', value: 'Below 80k, no' });
		const out = coerceDetails([...facts, next, decision]);
		expect(out).toHaveLength(12);
		expect(out.slice(0, 2).map((d) => d.category)).toEqual(['decision', 'next_step']);
		// The rest keep the model's own order.
		expect(out[2].label).toBe('Term 0');
	});

	it('caps the list', () => {
		const many = Array.from({ length: 30 }, (_, i) => detail({ label: `L${i}` }));
		expect(coerceDetails(many)).toHaveLength(12);
	});

	it('skips junk entries without losing the good ones after them', () => {
		const out = coerceDetails([null, 'nope', detail()]);
		expect(out).toHaveLength(1);
	});
});

describe('groupDetails', () => {
	it("groups in the vocabulary's order and omits empty categories", () => {
		const groups = groupDetails([
			detail({ category: 'other', label: 'Restructuring' }),
			detail({ category: 'requirement', label: 'References' }),
			detail({ category: 'compensation', label: 'Band' })
		]);

		expect(groups.map((g) => g.category)).toEqual(['requirement', 'compensation', 'other']);
		expect(groups.every((g) => g.items.length > 0)).toBe(true);
	});

	it('leads with the next step', () => {
		const groups = groupDetails([
			detail({ category: 'requirement', label: 'References' }),
			detail({ category: 'next_step', label: 'First round' })
		]);
		expect(groups.map((g) => g.label)).toEqual(['Next step', 'Requirements']);
	});

	it('is empty for no details', () => {
		expect(groupDetails([])).toEqual([]);
	});

	it('buckets an unrecognised category instead of hiding the row', () => {
		// A row written under an older vocabulary must not vanish from the page
		// while still sitting in the database.
		const groups = groupDetails([detail({ category: 'retired_category' })]);
		expect(groups).toHaveLength(1);
		expect(groups[0].category).toBe('other');
		expect(groups[0].items[0].label).toBe('Office days');
	});
});

describe('getDetailCategoryLabel', () => {
	it('falls back for an unknown or missing category', () => {
		expect(getDetailCategoryLabel('requirement')).toBe('Requirements');
		expect(getDetailCategoryLabel('nonsense')).toBe('Also worth knowing');
		expect(getDetailCategoryLabel(null)).toBe('Also worth knowing');
	});
});

describe('coerceEntryFacts', () => {
	// One entry is read once, and its digest is all the summariser sees of it:
	// a contract alone carries more terms than an application's twelve.
	it('keeps more than an application does', () => {
		const many = Array.from({ length: 25 }, (_, i) => detail({ label: `Term ${i}` }));
		expect(coerceDetails(many)).toHaveLength(12);
		expect(coerceEntryFacts(many)).toHaveLength(20);
	});

	it('carries no citation: the entry is where it is stored', () => {
		const [fact] = coerceEntryFacts([detail({ record_id: 9 })]);
		expect(fact).toEqual({
			category: 'requirement',
			label: 'Office days',
			value: 'Tuesdays and Thursdays, in Amsterdam'
		});
	});
});

describe('PRIVATE_DETAIL_CATEGORIES', () => {
	it('names the categories a letter to an employer must not carry', () => {
		expect([...PRIVATE_DETAIL_CATEGORIES].sort()).toEqual(['compensation', 'decision']);
	});
});

describe('a detail that arrives as a string', () => {
	// Measured on a real call transcript: the eleventh of eleven facts came back
	// as a string holding its object, and a strict schema lost all eleven.
	it('parses a string holding the object', () => {
		const raw = [
			detail({ label: 'Stack' }),
			JSON.stringify({ category: 'logistics', label: 'Next round', value: 'With the CTO' })
		];
		expect(coerceDetails(raw).map((d) => d.label)).toEqual(['Stack', 'Next round']);
		expect(coerceEntryFacts(raw)).toHaveLength(2);
	});

	it('drops a string that is not an object', () => {
		expect(coerceDetails(['just words', '["a"]', '{ broken'])).toEqual([]);
	});
});
