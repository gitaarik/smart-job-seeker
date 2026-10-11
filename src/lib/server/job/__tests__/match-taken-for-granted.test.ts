/**
 * skillsTakenForGranted: which of a job's skills the matcher leaves out of the
 * skill match for one profile. The levels themselves are tested in
 * assumed-levels.test.ts; this is the wiring to the job's spellings, the
 * profile's roles and its reach.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const roles = vi.fn();
vi.mock('$lib/server/db', () => ({
	dbDirect: { select: () => ({ from: () => ({ where: () => roles() }) }) }
}));
vi.mock('../skill-ontology', () => ({
	approvedAliasesOf: vi.fn(async () => []),
	assumedLevels: vi.fn(async () => new Map()),
	expandUpward: vi.fn(async () => []),
	expandUpwardBySeed: vi.fn(async () => new Map()),
	relatedTo: vi.fn(async () => []),
	resolveConcepts: vi.fn(async () => new Map())
}));

import { assumedLevels, resolveConcepts } from '../skill-ontology';
import { skillsTakenForGranted, type ProfileReach } from '../match-utils';

const reachWith = (seeds: Record<string, string[]>): ProfileReach => ({
	spelling: new Map(),
	byReached: new Map(),
	seedsByReached: new Map(Object.entries(seeds).map(([concept, s]) => [concept, new Set(s)])),
	expanded: [],
	adjacent: new Map()
});
const developer = reachWith({ softwaredevelopment: ['python', 'django', 'react', 'github'] });
const lastYear = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

describe('skillsTakenForGranted', () => {
	beforeEach(() => {
		vi.mocked(resolveConcepts).mockResolvedValue(
			new Map([['versioncontrol', { id: 1, slug: 'versioncontrol', label: 'Version control' }]])
		);
		vi.mocked(assumedLevels).mockResolvedValue(
			new Map([
				['versioncontrol', { from: 'junior', for: 'software developers' }],
				['git', { from: 'junior', for: 'software developers' }]
			])
		);
		roles.mockResolvedValue([{ start_date: '2010-01-01', end_date: null }]);
	});

	it('returns the job’s own spellings of the skills taken for granted', async () => {
		const granted = await skillsTakenForGranted(1, ['Version Control', 'GIT', 'Python'], developer);
		expect([...granted].sort()).toEqual(['GIT', 'Version Control']);
	});

	it('takes nothing for granted for a profile outside the line of work', async () => {
		expect((await skillsTakenForGranted(1, ['Version Control'], reachWith({}))).size).toBe(0);
	});

	it('takes nothing for granted below the level', async () => {
		roles.mockResolvedValue([{ start_date: lastYear, end_date: null }]);
		vi.mocked(assumedLevels).mockResolvedValue(
			new Map([['versioncontrol', { from: 'medior', for: 'software developers' }]])
		);
		expect((await skillsTakenForGranted(1, ['Version Control'], developer)).size).toBe(0);
	});

	it('asks nothing of the database for a job with no skills', async () => {
		vi.mocked(resolveConcepts).mockClear();
		expect((await skillsTakenForGranted(1, [], developer)).size).toBe(0);
		expect(resolveConcepts).not.toHaveBeenCalled();
	});
});
