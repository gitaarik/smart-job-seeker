import { describe, expect, it } from 'vitest';
import {
	applySkillVisibility,
	fitProfileToBudget,
	formatTrimNote,
	markExpiredCertificates,
	withCurrentKeys
} from '../profile-data';

const entry = (n: number, size = 200) => ({ id: n, text: 'x'.repeat(size) });

describe('fitProfileToBudget', () => {
	it('leaves a profile that already fits completely alone', () => {
		const data = { name: 'Alex', work_experiences: [entry(1), entry(2)] };
		const { data: out, dropped } = fitProfileToBudget(data, 100_000);
		expect(out).toEqual(data);
		expect(dropped).toEqual({});
	});

	it('drops from the END — the oldest entry goes, not the current one', () => {
		// exportProfile orders lists `asc(sort), desc(start_date)`: manual order
		// first, then most recent. Trimming the front would hide the current job.
		const data = { work_experiences: [entry(1), entry(2), entry(3), entry(4)] };
		const { data: out } = fitProfileToBudget(data, 500);
		const ids = (out.work_experiences as { id: number }[]).map((e) => e.id);
		expect(ids[0]).toBe(1);
		expect(ids).toEqual([...ids].sort((a, z) => a - z));
		expect(ids).not.toContain(4);
	});

	it('takes from the largest list first', () => {
		const data = {
			work_experiences: [entry(1, 2000), entry(2, 2000), entry(3, 2000)],
			languages: [entry(1, 10), entry(2, 10), entry(3, 10)]
		};
		const { dropped } = fitProfileToBudget(data, 4500);
		expect(dropped.work_experiences).toBeDefined();
		expect(dropped.languages).toBeUndefined();
	});

	it('never touches scalars', () => {
		const data = {
			name: 'Alex',
			summary: 'y'.repeat(5000),
			side_projects: [entry(1)]
		};
		const { data: out } = fitProfileToBudget(data, 100);
		expect(out.name).toBe('Alex');
		expect(out.summary).toHaveLength(5000);
	});

	it('keeps one entry per list rather than emptying it', () => {
		// A profile with zero work experience reads as "this person has never had a
		// job", which is worse than an over-budget prompt.
		const data = { work_experiences: [entry(1, 5000), entry(2, 5000)] };
		const { data: out } = fitProfileToBudget(data, 10);
		expect((out.work_experiences as unknown[]).length).toBe(1);
	});

	it('reports what it dropped', () => {
		const data = { work_experiences: [entry(1), entry(2), entry(3), entry(4)] };
		const { dropped } = fitProfileToBudget(data, 500);
		expect(dropped.work_experiences.total).toBe(4);
		expect(dropped.work_experiences.kept).toBeLessThan(4);
	});

	it('does not mutate the input', () => {
		const data = { work_experiences: [entry(1), entry(2), entry(3), entry(4)] };
		fitProfileToBudget(data, 500);
		expect(data.work_experiences).toHaveLength(4);
	});
});

describe('formatTrimNote', () => {
	it('is empty when nothing was dropped', () => {
		expect(formatTrimNote({})).toBe('');
	});

	it("tells the model the profile is partial, so it doesn't infer absence", () => {
		const note = formatTrimNote({ work_experiences: { kept: 3, total: 8 } });
		expect(note).toContain('3 of 8');
		expect(note.toLowerCase()).toContain('partial');
	});
});

describe('applySkillVisibility', () => {
	const blob = () => ({
		name: 'Alex',
		tech_skill_categories: [
			{
				name: 'Backend',
				tech_skills: [
					{ name: 'Go', level: 'expert' },
					{ name: 'Kubernetes', level: 'beginner', profile_only: true }
				]
			},
			{ name: 'Empty', tech_skills: [] }
		]
	});

	function names(data: Record<string, unknown>, category = 0): string[] {
		const cats = data.tech_skill_categories as Array<{ tech_skills: { name: string }[] }>;
		return cats[category].tech_skills.map((s) => s.name);
	}

	it("keeps every skill for analysis — matching's whole premise", () => {
		// A profile-only skill exists precisely so jobs keep matching on it. This
		// is the assertion that broke when the export dropped them: a skill added
		// from a job came back reported as a gap.
		const out = applySkillVisibility(blob(), false);
		expect(names(out)).toEqual(['Go', 'Kubernetes']);
	});

	it('drops held-back skills from anything document-facing', () => {
		const out = applySkillVisibility(blob(), true);
		expect(names(out)).toEqual(['Go']);
	});

	it('strips the marker either way — no prompt reasons about visibility', () => {
		for (const documentSafe of [true, false]) {
			const out = applySkillVisibility(blob(), documentSafe);
			const cats = out.tech_skill_categories as Array<{ tech_skills: Record<string, unknown>[] }>;
			for (const skill of cats[0].tech_skills) {
				expect(skill).not.toHaveProperty('profile_only');
			}
		}
	});

	it('leaves the rest of the profile untouched', () => {
		const out = applySkillVisibility(blob(), true);
		expect(out.name).toBe('Alex');
		expect(names(out, 1)).toEqual([]);
	});

	it('survives a blob without skills', () => {
		expect(applySkillVisibility({ name: 'Alex' }, true)).toEqual({
			name: 'Alex'
		});
		expect(applySkillVisibility({ tech_skill_categories: 'nonsense' }, true)).toEqual({
			tech_skill_categories: 'nonsense'
		});
	});
});

describe('markExpiredCertificates', () => {
	const today = '2026-09-26';

	it('marks a certificate whose expiry date has passed', () => {
		const data = { certificates: [{ name: 'CKA', expiry_date: '2026-09-25' }] };
		expect(markExpiredCertificates(data, today).certificates).toEqual([
			{ name: 'CKA', expiry_date: '2026-09-25', expired: true }
		]);
	});

	it('leaves one that expires today, later, or never', () => {
		const certificates = [
			{ name: 'Today', expiry_date: '2026-09-26' },
			{ name: 'Later', expiry_date: '2027-01-01' },
			{ name: 'Never', expiry_date: null },
			{ name: 'Unsaid' }
		];
		expect(markExpiredCertificates({ certificates }, today).certificates).toEqual(certificates);
	});

	it('passes a blob without certificates through untouched', () => {
		const data = { name: 'Alex' };
		expect(markExpiredCertificates(data, today)).toBe(data);
	});
});

describe('withCurrentKeys', () => {
	it('drops a key the export no longer writes, which no drop-list can name', () => {
		// A blob written before the salary split, read after it: NON_FIT_FIELDS
		// cannot list salary_base_rate any more, so only this keeps it from the
		// matcher.
		const stale = {
			name: 'Alex',
			salary_base_rate: 50,
			salary_currency: 'EUR',
			salary_region_overrides: {},
			salary_adjustments: { work_arrangement: { onsite: 15 } }
		};
		expect(withCurrentKeys(stale)).toEqual({
			name: 'Alex',
			salary_adjustments: { work_arrangement: { onsite: 15 } }
		});
	});

	it("filters the schema blob's fields and relations the same way", () => {
		const schema = {
			note: 'profile',
			fields: { name: '', salary_base_rate: '' },
			relations: { highlights: { fields: {} }, salary_expectations: { fields: {} } }
		};
		expect(withCurrentKeys(schema)).toEqual({
			note: 'profile',
			fields: { name: '' },
			relations: { highlights: { fields: {} } }
		});
	});
});
