/**
 * Unit tests for profile export utility functions
 * Tests schema and data export logic with mocked database
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the database
vi.mock('$lib/server/db', () => ({
	db: {
		query: {
			profiles: {
				findFirst: vi.fn()
			},
			collected_data: {
				findFirst: vi.fn()
			}
		},
		insert: vi.fn(),
		update: vi.fn()
	}
}));

// Mock remove-markdown
vi.mock('remove-markdown', () => ({
	default: (text: string) => text.replace(/[#*_`[\]]/g, '')
}));

import { exportProfile } from '../profile/export';
import { db } from '$lib/server/db';
import { findFirst, asMock } from './db-mocks';

describe('exportProfile', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should export both schema and data atomically', async () => {
		// Setup for profile check - profile not found
		findFirst(db.query.profiles).mockResolvedValueOnce(null);

		const result = await exportProfile(1);

		// Verify structure of response
		expect(result).toHaveProperty('success');
		expect(result).toHaveProperty('message');
		expect(result.success).toBe(false);
		expect(result.message).toContain('not found');
	});

	it('marks profile-only skills in the AI snapshot rather than dropping them', async () => {
		findFirst(db.query.profiles)
			.mockResolvedValueOnce({ id: 1 }) // existence check
			.mockResolvedValueOnce({
				name: 'Alex',
				tech_skill_categories: [
					{
						name: 'Backend',
						tech_skills: [
							{ name: 'Go', level: 'expert', years_experience: 5, tags: null },
							// Held back from documents — but still the applicant's skill, so
							// it stays in the snapshot for the prompts that analyse them.
							{
								name: 'Kubernetes',
								level: 'beginner',
								years_experience: 1,
								tags: ['!resume', '!cv']
							},
							// Restricted to one version, but still printed somewhere — keep.
							{
								name: 'Rust',
								level: null,
								years_experience: null,
								tags: ['senior']
							}
						]
					}
				]
			});
		findFirst(db.query.collected_data).mockResolvedValueOnce(null);

		const values = vi.fn().mockResolvedValue(undefined);
		asMock(db.insert).mockReturnValue({ values });

		const result = await exportProfile(1);
		expect(result.success).toBe(true);

		const written = JSON.parse(values.mock.calls[0][0].data);
		const skills = written.tech_skill_categories[0].tech_skills;
		expect(skills.map((s: { name: string }) => s.name)).toEqual(['Go', 'Kubernetes', 'Rust']);
		// Dropping it here cost it job matching, which is the one thing a
		// profile-only skill exists to do.
		expect(skills[1]).toMatchObject({ name: 'Kubernetes', profile_only: true });
		// Only the held-back one is marked; the rest look exactly as before.
		expect(skills[0]).not.toHaveProperty('profile_only');
		expect(skills[2]).not.toHaveProperty('profile_only');
		// `tags` is a visibility mechanism, not profile content.
		expect(skills[0]).not.toHaveProperty('tags');
		expect(skills[1]).not.toHaveProperty('tags');
	});

	it('ships each salary ask with its year worked out, and the comparison', async () => {
		findFirst(db.query.profiles)
			.mockResolvedValueOnce({ id: 1 })
			.mockResolvedValueOnce({
				name: 'Alex',
				tech_skill_categories: [],
				salary_employed: {
					amount: 8700,
					taxPct: 40,
					regions: { us: { amount: 10440, currency: 'USD' }, uk: { amount: 0, currency: 'GBP' } }
				},
				salary_freelance: { amount: 83, taxPct: 45, costsPerYear: 0 },
				salary_adjustments: { employment_type: { contract: 65 }, work_arrangement: { onsite: 15 } }
			});
		findFirst(db.query.collected_data).mockResolvedValueOnce(null);
		const values = vi.fn().mockResolvedValue(undefined);
		asMock(db.insert).mockReturnValue({ values });

		expect((await exportProfile(1)).success).toBe(true);
		const written = JSON.parse(values.mock.calls[0][0].data);

		expect(written.salary_employed.per_year).toMatchObject({ grossPay: 112752, kept: 78926 });
		// A region row still blank on the page prices nothing, so it is not quoted.
		expect(written.salary_employed.regions).toEqual({ us: { amount: 10440, currency: 'USD' } });
		expect(written.salary_freelance.compared_with_salary).toEqual({
			rate_keeping_the_same_as_the_salary: 79,
			salary_keeping_the_same_as_this_rate: 9145,
			rate_above_that_by_pct: 5
		});
		// The old contract premium is the freelance ask now; it must not be applied twice.
		expect(written.salary_adjustments.employment_type).toBeUndefined();
		expect(written.salary_adjustments.note).toMatch(/salary_employed/);
	});

	it('leaves the salary keys out when neither ask has an amount', async () => {
		findFirst(db.query.profiles)
			.mockResolvedValueOnce({ id: 1 })
			.mockResolvedValueOnce({
				name: 'Alex',
				tech_skill_categories: [],
				salary_employed: { amount: null },
				salary_freelance: null,
				salary_adjustments: null
			});
		findFirst(db.query.collected_data).mockResolvedValueOnce(null);
		const values = vi.fn().mockResolvedValue(undefined);
		asMock(db.insert).mockReturnValue({ values });

		await exportProfile(1);
		const written = JSON.parse(values.mock.calls[0][0].data);
		expect(written).not.toHaveProperty('salary_employed');
		expect(written).not.toHaveProperty('salary_freelance');
		expect(written).not.toHaveProperty('salary_adjustments');
	});
});
