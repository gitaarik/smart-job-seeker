import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		query: {
			profile_versions: { findMany: vi.fn() },
			tech_skill_categories: { findMany: vi.fn() }
		}
	}
}));

import { getHiddenRequiredSkills, hiddenSkillsKey } from '../hidden-required-skills';
import { dbDirect as db } from '$lib/server/db';

const PROFILE_ONLY = ['!resume', '!cv'];

// One standalone version ("backend") and one ("senior") extending it.
const VERSIONS = [
	{ id: 1, slug: 'backend', toggles: [], extension_links: [] },
	{ id: 2, slug: 'senior', toggles: [], extension_links: [{ extended_id: 1 }] }
];

function setup(
	categories: Array<{
		id: number;
		tags: string[] | null;
		tech_skills: Array<{ id: number; name: string; tags: string[] | null }>;
	}>
) {
	(db.query.profile_versions.findMany as any).mockResolvedValue(VERSIONS);
	(db.query.tech_skill_categories.findMany as any).mockResolvedValue(categories);
}

function names(hidden: { name: string }[] | undefined): string[] {
	return (hidden ?? []).map((s) => s.name);
}

describe('getHiddenRequiredSkills', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns nothing when the job requires no skills', async () => {
		expect(await getHiddenRequiredSkills(1, [])).toEqual({});
		expect(db.query.tech_skill_categories.findMany).not.toHaveBeenCalled();
	});

	it("ignores required skills the profile doesn't have", async () => {
		setup([
			{
				id: 10,
				tags: null,
				tech_skills: [{ id: 100, name: 'Go', tags: null }]
			}
		]);
		expect(await getHiddenRequiredSkills(1, ['Rust'])).toEqual({});
	});

	it('ignores skills that do print', async () => {
		setup([
			{
				id: 10,
				tags: null,
				tech_skills: [{ id: 100, name: 'Go', tags: null }]
			}
		]);
		expect(await getHiddenRequiredSkills(1, ['Go'])).toEqual({});
	});

	it('flags a profile-only required skill on every document', async () => {
		setup([
			{
				id: 10,
				tags: null,
				tech_skills: [{ id: 100, name: 'Kubernetes', tags: PROFILE_ONLY }]
			}
		]);

		const hidden = await getHiddenRequiredSkills(1, ['Kubernetes']);

		for (const key of ['resume:', 'cv:', 'resume:backend', 'cv:senior']) {
			expect(names(hidden[key])).toEqual(['Kubernetes']);
		}
		expect(hidden['resume:backend'][0].id).toBe(100);
	});

	it('does not flag a version the skill was re-admitted on', async () => {
		// The distinction profile-only alone can't make: still held back in
		// general, but it prints fine on backend (and on senior, which extends it).
		setup([
			{
				id: 10,
				tags: null,
				tech_skills: [
					{
						id: 100,
						name: 'Kubernetes',
						tags: [...PROFILE_ONLY, 'backend']
					}
				]
			}
		]);

		const hidden = await getHiddenRequiredSkills(1, ['Kubernetes']);

		expect(hidden[hiddenSkillsKey('resume', 'backend')]).toBeUndefined();
		expect(hidden[hiddenSkillsKey('cv', 'senior')]).toBeUndefined();
		// …but the plain base document still omits it.
		expect(names(hidden[hiddenSkillsKey('resume', '')])).toEqual(['Kubernetes']);
	});

	it("respects a base-template restriction, and won't promise a fix", async () => {
		setup([
			{
				id: 10,
				tags: null,
				tech_skills: [{ id: 100, name: 'Latex', tags: ['cv'] }]
			}
		]);

		const hidden = await getHiddenRequiredSkills(1, ['Latex']);

		expect(hidden[hiddenSkillsKey('cv', '')]).toBeUndefined();
		expect(names(hidden[hiddenSkillsKey('resume', '')])).toEqual(['Latex']);
		// Tagging a version can't beat "CV only" — don't offer the button.
		expect(hidden[hiddenSkillsKey('resume', 'backend')][0].liftable).toBe(false);
	});

	it('counts a skill hidden when its category is hidden', async () => {
		// The skill itself is untagged, but its whole category is held back — both
		// templates render categories first, so it never reaches the page.
		setup([
			{
				id: 10,
				tags: PROFILE_ONLY,
				tech_skills: [{ id: 100, name: 'Kubernetes', tags: null }]
			}
		]);

		const hidden = await getHiddenRequiredSkills(1, ['Kubernetes']);
		const entry = hidden[hiddenSkillsKey('resume', 'backend')][0];

		expect(entry.name).toBe('Kubernetes');
		// Lifting the skill wouldn't help while its category stays hidden.
		expect(entry.liftable).toBe(false);
	});

	it('marks a profile-only skill liftable', async () => {
		setup([
			{
				id: 10,
				tags: null,
				tech_skills: [{ id: 100, name: 'Kubernetes', tags: PROFILE_ONLY }]
			}
		]);

		const hidden = await getHiddenRequiredSkills(1, ['Kubernetes']);

		expect(hidden[hiddenSkillsKey('resume', 'backend')][0].liftable).toBe(true);
		// On the plain base document the lift is "show on all documents".
		expect(hidden[hiddenSkillsKey('resume', '')][0].liftable).toBe(true);
	});

	it("won't offer a lift that a version exclusion would defeat", async () => {
		setup([
			{
				id: 10,
				tags: null,
				tech_skills: [
					{
						id: 100,
						name: 'Kubernetes',
						tags: [...PROFILE_ONLY, '!backend']
					}
				]
			}
		]);

		const hidden = await getHiddenRequiredSkills(1, ['Kubernetes']);

		expect(hidden[hiddenSkillsKey('resume', 'backend')][0].liftable).toBe(false);
		expect(hidden[hiddenSkillsKey('resume', '')][0].liftable).toBe(true);
	});

	it('matches names case-insensitively and ignores unknown casing gaps', async () => {
		setup([
			{
				id: 10,
				tags: null,
				tech_skills: [{ id: 100, name: 'Kubernetes', tags: PROFILE_ONLY }]
			}
		]);

		const hidden = await getHiddenRequiredSkills(1, ['  kubernetes ']);
		expect(names(hidden[hiddenSkillsKey('resume', '')])).toEqual(['Kubernetes']);
	});
});
