/**
 * Tests for getSkillVocabularyReach.
 *
 * The SQL is exercised against the real corpus by hand; what is worth pinning
 * here is the arithmetic and the degenerate cases, because this number is shown
 * to a person as a judgement about their profile and a wrong one is worse than
 * none.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted, because vi.mock is lifted above the const declarations and a
// plain `const fn = vi.fn()` referenced from a factory is still in its temporal
// dead zone when the factory runs.
const { queryRaw, getExpandedProfileSkills } = vi.hoisted(() => ({
	queryRaw: vi.fn(),
	getExpandedProfileSkills: vi.fn()
}));

vi.mock('$lib/server/db', async () => {
	const { sql } = await import('drizzle-orm');
	return {
		dbDirect: { query: {} },
		queryRaw,
		sql,
		sqlJoin: (values: unknown[]) =>
			sql.join(
				values.map((v) => sql`${v}`),
				sql.raw(',')
			)
	};
});
vi.mock('$lib/server/job/match-utils', () => ({ getExpandedProfileSkills }));

import { getSkillVocabularyReach } from '../match-counts';

beforeEach(() => {
	queryRaw.mockReset();
	getExpandedProfileSkills.mockReset();
});

describe('getSkillVocabularyReach', () => {
	it('reports the reached share of skill-carrying jobs', async () => {
		getExpandedProfileSkills.mockResolvedValue(['Python', 'SQL']);
		queryRaw.mockResolvedValue([{ with_skills: 5700, reached: 4317 }]);

		expect(await getSkillVocabularyReach(1, true)).toEqual({
			jobsWithSkills: 5700,
			reachedJobs: 4317,
			percentage: 76,
			profileSkillCount: 2
		});
	});

	// Profile 52's real shape on preview: skills listed, none of them occurring
	// anywhere in the corpus. Zero is a finding, not missing data, and must not
	// collapse to the same null as "nothing to measure".
	it('reports 0 rather than null when the profile reaches nothing', async () => {
		getExpandedProfileSkills.mockResolvedValue(['Sustainable Trade']);
		queryRaw.mockResolvedValue([{ with_skills: 5700, reached: 0 }]);

		const reach = await getSkillVocabularyReach(52, true);
		expect(reach.percentage).toBe(0);
		expect(reach.reachedJobs).toBe(0);
	});

	it('returns null when no job in scope lists any skills', async () => {
		getExpandedProfileSkills.mockResolvedValue(['Python']);
		queryRaw.mockResolvedValue([{ with_skills: 0, reached: 0 }]);

		expect((await getSkillVocabularyReach(1, false)).percentage).toBeNull();
	});

	// A profile with no skills cannot be told its vocabulary is the problem, and
	// the query would bind an empty array, so it is not run at all.
	it('short-circuits a profile with no skills without querying', async () => {
		getExpandedProfileSkills.mockResolvedValue([]);

		expect(await getSkillVocabularyReach(9, true)).toEqual({
			jobsWithSkills: 0,
			reachedJobs: 0,
			percentage: null,
			profileSkillCount: 0
		});
		expect(queryRaw).not.toHaveBeenCalled();
	});

	// Same reason the filter in buildEligibilityFilter drops them: an empty
	// normalized key compares equal to every job skill that also normalizes to
	// empty, which would report near-total reach for a profile of punctuation.
	it('drops skills that normalize to nothing, and short-circuits if all do', async () => {
		getExpandedProfileSkills.mockResolvedValue(['---', '!!']);
		expect((await getSkillVocabularyReach(9, true)).profileSkillCount).toBe(0);
		expect(queryRaw).not.toHaveBeenCalled();

		getExpandedProfileSkills.mockResolvedValue(['---', 'Python', 'python']);
		queryRaw.mockResolvedValue([{ with_skills: 10, reached: 5 }]);
		// "Python" and "python" are one skill; "---" is none.
		expect((await getSkillVocabularyReach(9, true)).profileSkillCount).toBe(1);
	});

	it('survives a query that returns no row', async () => {
		getExpandedProfileSkills.mockResolvedValue(['Python']);
		queryRaw.mockResolvedValue([]);

		expect(await getSkillVocabularyReach(1, true)).toMatchObject({
			jobsWithSkills: 0,
			reachedJobs: 0,
			percentage: null
		});
	});
});
