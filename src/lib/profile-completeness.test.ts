/**
 * The gap list is what an interview chooses its next question from, and what
 * Getting Started's step 1 can name. The properties worth pinning are the ones
 * a caller relies on without reading the code: its blockers agree with
 * `isProfileReadyForMatching`, its order is stable, and it never says the same
 * thing twice.
 */
import { describe, expect, it } from 'vitest';
import {
	GAP_SECTIONS,
	LOW_SKILL_REACH_PERCENT,
	MIN_JOBS_FOR_SKILL_REACH,
	MIN_SKILLS_FOR_MATCHING,
	isProfileReadyForMatching,
	isSkillReachLow,
	rankProfileGaps,
	type GapRole,
	type ProfileGapInput
} from './profile-completeness';

function role(id: number, overrides: Partial<GapRole> = {}): GapRole {
	return { id, label: `Role ${id}`, achievementCount: 2, technologyCount: 3, ...overrides };
}

/** A profile with nothing missing, so each test removes exactly what it is about. */
function full(overrides: Partial<ProfileGapInput> = {}): ProfileGapInput {
	return {
		skillCount: 40,
		workExperiences: [role(1)],
		educationCount: 1,
		sideProjectCount: 1,
		certificateCount: 1,
		languageCount: 1,
		skillReach: { percentage: 70, jobsWithSkills: 500 },
		...overrides
	};
}

const EMPTY: ProfileGapInput = {
	skillCount: 0,
	workExperiences: [],
	educationCount: 0,
	sideProjectCount: 0,
	certificateCount: 0,
	languageCount: 0,
	skillReach: null
};

const kinds = (input: ProfileGapInput) => rankProfileGaps(input).map((g) => g.kind);

describe('isSkillReachLow', () => {
	it('is false with no reading, or nothing to measure', () => {
		expect(isSkillReachLow(null)).toBe(false);
		expect(isSkillReachLow(undefined)).toBe(false);
		expect(isSkillReachLow({ percentage: null, jobsWithSkills: 0 })).toBe(false);
	});

	it('is true inside the empty band on a big enough corpus', () => {
		expect(isSkillReachLow({ percentage: 0, jobsWithSkills: 500 })).toBe(true);
		expect(isSkillReachLow({ percentage: 9, jobsWithSkills: 500 })).toBe(true);
	});

	it('draws both boundaries where the constants say', () => {
		const n = MIN_JOBS_FOR_SKILL_REACH;
		expect(isSkillReachLow({ percentage: LOW_SKILL_REACH_PERCENT - 1, jobsWithSkills: n })).toBe(
			true
		);
		expect(isSkillReachLow({ percentage: LOW_SKILL_REACH_PERCENT, jobsWithSkills: n })).toBe(false);
		expect(isSkillReachLow({ percentage: 0, jobsWithSkills: n - 1 })).toBe(false);
	});

	// The measured populations: 67-76% and 0-9%, nothing between.
	it('separates the two measured clusters', () => {
		expect(isSkillReachLow({ percentage: 67, jobsWithSkills: 500 })).toBe(false);
		expect(isSkillReachLow({ percentage: 7, jobsWithSkills: 500 })).toBe(true);
	});
});

describe('rankProfileGaps', () => {
	it('finds nothing missing in a complete profile', () => {
		expect(rankProfileGaps(full())).toEqual([]);
	});

	it('ranks an empty profile blockers first, without repeating them as empty sections', () => {
		expect(rankProfileGaps(EMPTY)).toEqual([
			{ kind: 'no_experience_or_education', blocksMatching: true },
			{ kind: 'too_few_skills', blocksMatching: true, skillCount: 0, floor: 12 },
			{ kind: 'empty_section', blocksMatching: false, section: 'side_project' },
			{ kind: 'empty_section', blocksMatching: false, section: 'certificate' },
			{ kind: 'empty_section', blocksMatching: false, section: 'language' }
		]);
	});

	it('does not report reach for a profile with no skills to reach with', () => {
		const gaps = rankProfileGaps({
			...EMPTY,
			skillReach: { percentage: 0, jobsWithSkills: 500 }
		});
		expect(gaps.map((g) => g.kind)).not.toContain('low_skill_reach');
	});

	it('reports too few skills with the count and the floor', () => {
		expect(rankProfileGaps(full({ skillCount: 5 }))).toEqual([
			{
				kind: 'too_few_skills',
				blocksMatching: true,
				skillCount: 5,
				floor: MIN_SKILLS_FOR_MATCHING
			}
		]);
		expect(kinds(full({ skillCount: MIN_SKILLS_FOR_MATCHING }))).toEqual([]);
	});

	// D7: reach, not count, says whether the skills land. Plenty of skills is
	// not enough when none of them are the corpus's words.
	it('reports low reach even when the skill count clears the floor', () => {
		expect(rankProfileGaps(full({ skillReach: { percentage: 3, jobsWithSkills: 400 } }))).toEqual([
			{ kind: 'low_skill_reach', blocksMatching: false, percentage: 3, jobsWithSkills: 400 }
		]);
	});

	// Profile 48: eleven skills, 67% reach. Short, but the right vocabulary.
	it('reports only the count for a short list that reaches well', () => {
		expect(
			kinds(full({ skillCount: 11, skillReach: { percentage: 67, jobsWithSkills: 400 } }))
		).toEqual(['too_few_skills']);
	});

	it('reports both for a short list that also misses', () => {
		expect(
			kinds(full({ skillCount: 8, skillReach: { percentage: 1, jobsWithSkills: 400 } }))
		).toEqual(['too_few_skills', 'low_skill_reach']);
	});

	it('says nothing about reach it was not given, or could not measure', () => {
		expect(kinds(full({ skillReach: null }))).toEqual([]);
		expect(kinds(full({ skillReach: { percentage: null, jobsWithSkills: 0 } }))).toEqual([]);
		expect(kinds(full({ skillReach: { percentage: 0, jobsWithSkills: 4 } }))).toEqual([]);
	});

	it('names the role a gap is about', () => {
		const gaps = rankProfileGaps(
			full({
				workExperiences: [
					role(7, { label: 'Nurse at St. Mary', achievementCount: 0, technologyCount: 0 })
				]
			})
		);
		expect(gaps).toEqual([
			{
				kind: 'role_without_achievements',
				blocksMatching: false,
				roleId: 7,
				label: 'Nurse at St. Mary'
			},
			{
				kind: 'role_without_technologies',
				blocksMatching: false,
				roleId: 7,
				label: 'Nurse at St. Mary'
			}
		]);
	});

	// D3: finish the role, then move on.
	it('keeps each role’s gaps together, in the order the roles were given', () => {
		const gaps = rankProfileGaps(
			full({
				workExperiences: [
					role(3, { achievementCount: 0, technologyCount: 0 }),
					role(1),
					role(2, { technologyCount: 0 }),
					role(4, { achievementCount: 0 })
				]
			})
		);
		expect(gaps.map((g) => ('roleId' in g ? `${g.kind}:${g.roleId}` : g.kind))).toEqual([
			'role_without_achievements:3',
			'role_without_technologies:3',
			'role_without_technologies:2',
			'role_without_achievements:4'
		]);
	});

	it('reports a missing half of history as an empty section, not a blocker', () => {
		expect(rankProfileGaps(full({ educationCount: 0 }))).toEqual([
			{ kind: 'empty_section', blocksMatching: false, section: 'education' }
		]);
		expect(rankProfileGaps(full({ workExperiences: [] }))).toEqual([
			{ kind: 'empty_section', blocksMatching: false, section: 'work_experience' }
		]);
	});

	it('orders tiers: blockers, reach, roles, sections', () => {
		const order = kinds({
			skillCount: 4,
			workExperiences: [role(1, { achievementCount: 0 })],
			educationCount: 0,
			sideProjectCount: 0,
			certificateCount: 1,
			languageCount: 1,
			skillReach: { percentage: 2, jobsWithSkills: 300 }
		});
		expect(order).toEqual([
			'too_few_skills',
			'low_skill_reach',
			'role_without_achievements',
			'empty_section',
			'empty_section'
		]);
		expect(
			rankProfileGaps({
				skillCount: 4,
				workExperiences: [role(1)],
				educationCount: 0,
				sideProjectCount: 0,
				certificateCount: 1,
				languageCount: 1,
				skillReach: null
			})
				.filter((g) => g.kind === 'empty_section')
				.map((g) => (g.kind === 'empty_section' ? g.section : ''))
		).toEqual(['education', 'side_project']);
	});

	it('lists empty sections in GAP_SECTIONS order', () => {
		const sections = rankProfileGaps({ ...EMPTY, workExperiences: [role(1)] }).flatMap((g) =>
			g.kind === 'empty_section' ? [g.section] : []
		);
		expect(sections).toEqual(GAP_SECTIONS.filter((s) => s !== 'work_experience'));
	});

	it('never reports the same gap twice', () => {
		const gaps = rankProfileGaps({
			...EMPTY,
			workExperiences: [role(1, { achievementCount: 0, technologyCount: 0 }), role(2)],
			skillCount: 3,
			skillReach: { percentage: 0, jobsWithSkills: 100 }
		});
		const keys = gaps.map((g) => JSON.stringify(g));
		expect(new Set(keys).size).toBe(keys.length);
	});

	/**
	 * D5: the interview stops at `isProfileReadyForMatching`. If the list's
	 * blockers could disagree with it, the interview would either stop with a
	 * blocker outstanding or keep asking after the bar was cleared. Checked over
	 * the whole space of inputs that bar reads, including both floor edges.
	 */
	it('has a blocker exactly when the profile is not ready for matching', () => {
		for (const skillCount of [0, 1, MIN_SKILLS_FOR_MATCHING - 1, MIN_SKILLS_FOR_MATCHING, 57]) {
			for (const roles of [0, 1, 2]) {
				for (const educationCount of [0, 1]) {
					for (const skillReach of [null, { percentage: 0, jobsWithSkills: 500 }]) {
						const input: ProfileGapInput = {
							...EMPTY,
							skillCount,
							workExperiences: Array.from({ length: roles }, (_, i) =>
								role(i + 1, { achievementCount: 0, technologyCount: 0 })
							),
							educationCount,
							skillReach
						};
						const ready = isProfileReadyForMatching({
							hasSkills: skillCount > 0,
							skillCount,
							hasMatchConfig: false,
							hasWorkExperience: roles > 0,
							hasEducation: educationCount > 0,
							hasExperienceOrEducation: roles > 0 || educationCount > 0
						});
						const blocked = rankProfileGaps(input).some((g) => g.blocksMatching);
						expect(blocked, JSON.stringify(input)).toBe(!ready);
					}
				}
			}
		}
	});

	it('does not mutate its input', () => {
		const input = full({ workExperiences: [role(1, { achievementCount: 0 })] });
		const before = structuredClone(input);
		rankProfileGaps(input);
		expect(input).toEqual(before);
	});
});
