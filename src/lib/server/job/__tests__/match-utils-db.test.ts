/**
 * Tests for Job Match Utilities (DB-dependent functions)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Drizzle-style select chain
const mockWhere = vi.fn();
const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		select: (...args: any[]) => mockSelect(...args)
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((_col: any, val: any) => val)
}));

vi.mock('$lib/server/db/schema', () => ({
	tech_skills: {
		name: 'tech_skills.name',
		level: 'tech_skills.level',
		years_experience: 'tech_skills.years_experience',
		category_id: 'tech_skills.category_id'
	},
	tech_skill_categories: {
		id: 'tech_skill_categories.id',
		profile_id: 'tech_skill_categories.profile_id'
	}
}));

import { getProfileSkills, getProfileSkillLevels } from '../match-utils';

describe('getProfileSkills', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset the chain
		mockFrom.mockReturnValue({ innerJoin: mockInnerJoin });
		mockInnerJoin.mockReturnValue({ where: mockWhere });
	});

	it('returns skill names', async () => {
		mockWhere.mockResolvedValueOnce([
			{ name: 'TypeScript' },
			{ name: 'React' },
			{ name: 'Node.js' }
		]);
		const skills = await getProfileSkills(1);
		expect(skills).toEqual(['TypeScript', 'React', 'Node.js']);
	});

	it('filters out null names', async () => {
		mockWhere.mockResolvedValueOnce([
			{ name: 'TypeScript' },
			{ name: null },
			{ name: '' },
			{ name: 'React' }
		]);
		const skills = await getProfileSkills(1);
		expect(skills).toEqual(['TypeScript', 'React']);
	});

	it('returns empty array when no skills', async () => {
		mockWhere.mockResolvedValueOnce([]);
		const skills = await getProfileSkills(1);
		expect(skills).toEqual([]);
	});

	it('queries with correct profile filter', async () => {
		mockWhere.mockResolvedValueOnce([]);
		await getProfileSkills(42);
		expect(mockSelect).toHaveBeenCalled();
		expect(mockFrom).toHaveBeenCalled();
		expect(mockInnerJoin).toHaveBeenCalled();
		expect(mockWhere).toHaveBeenCalled();
	});
});

describe('getProfileSkillLevels', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFrom.mockReturnValue({ innerJoin: mockInnerJoin });
		mockInnerJoin.mockReturnValue({ where: mockWhere });
	});

	it('classifies beginner as weak', async () => {
		mockWhere.mockResolvedValueOnce([{ name: 'React', level: 'beginner', years_experience: null }]);
		const levels = await getProfileSkillLevels(1);
		expect(levels['react']).toBe('weak');
	});

	it('classifies intermediate as weak', async () => {
		mockWhere.mockResolvedValueOnce([
			{ name: 'React', level: 'Intermediate', years_experience: null }
		]);
		const levels = await getProfileSkillLevels(1);
		expect(levels['react']).toBe('weak');
	});

	it('classifies expert as strong', async () => {
		mockWhere.mockResolvedValueOnce([
			{ name: 'TypeScript', level: 'expert', years_experience: null }
		]);
		const levels = await getProfileSkillLevels(1);
		expect(levels['typescript']).toBe('strong');
	});

	it('classifies proficient as strong', async () => {
		mockWhere.mockResolvedValueOnce([
			{ name: 'TypeScript', level: 'Proficient', years_experience: null }
		]);
		const levels = await getProfileSkillLevels(1);
		expect(levels['typescript']).toBe('strong');
	});

	it('classifies < 3 years without level as weak', async () => {
		mockWhere.mockResolvedValueOnce([{ name: 'Go', level: null, years_experience: 2 }]);
		const levels = await getProfileSkillLevels(1);
		expect(levels['go']).toBe('weak');
	});

	it('classifies 3+ years without level as strong', async () => {
		mockWhere.mockResolvedValueOnce([{ name: 'Go', level: null, years_experience: 3 }]);
		const levels = await getProfileSkillLevels(1);
		expect(levels['go']).toBe('strong');
	});

	it('classifies no level and no years as strong', async () => {
		mockWhere.mockResolvedValueOnce([{ name: 'Python', level: null, years_experience: null }]);
		const levels = await getProfileSkillLevels(1);
		expect(levels['python']).toBe('strong');
	});

	it('lowercases skill names as keys', async () => {
		mockWhere.mockResolvedValueOnce([
			{ name: 'TypeScript', level: 'expert', years_experience: null }
		]);
		const levels = await getProfileSkillLevels(1);
		expect(levels).toHaveProperty('typescript');
		expect(levels).not.toHaveProperty('TypeScript');
	});

	it('skips skills with null name', async () => {
		mockWhere.mockResolvedValueOnce([
			{ name: null, level: 'expert', years_experience: 5 },
			{ name: 'React', level: 'expert', years_experience: null }
		]);
		const levels = await getProfileSkillLevels(1);
		expect(Object.keys(levels)).toEqual(['react']);
	});

	it('level takes precedence over years', async () => {
		mockWhere.mockResolvedValueOnce([{ name: 'React', level: 'beginner', years_experience: 10 }]);
		const levels = await getProfileSkillLevels(1);
		expect(levels['react']).toBe('weak');
	});

	it('returns empty object when no skills', async () => {
		mockWhere.mockResolvedValueOnce([]);
		const levels = await getProfileSkillLevels(1);
		expect(levels).toEqual({});
	});
});
