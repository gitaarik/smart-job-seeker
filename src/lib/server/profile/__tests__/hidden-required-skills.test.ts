import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		query: {
			profile_versions: { findMany: vi.fn() },
			tech_skill_categories: { findMany: vi.fn() },
			work_experiences: { findMany: vi.fn() }
		}
	}
}));

import { getVersionCoverage, hiddenSkillsKey } from '../hidden-required-skills';
import type { HiddenSkill } from '$lib/version-coverage';

/**
 * The hidden lists alone — a view over the coverage map, which is what the
 * module actually returns now that the same loop answers both "what would this
 * document hide" and "how much of the job does it cover". Only pairs with
 * something hidden appear, so an absent key still means "shows everything".
 */
async function getHiddenRequiredSkills(
	profileId: number,
	requiredSkills: string[]
): Promise<Record<string, HiddenSkill[]>> {
	const coverage = await getVersionCoverage(profileId, requiredSkills);
	const result: Record<string, HiddenSkill[]> = {};
	for (const [key, entry] of Object.entries(coverage)) {
		if (entry.hidden.length > 0) result[key] = entry.hidden;
	}
	return result;
}
import { dbDirect as db } from '$lib/server/db';

/**
 * The mocked `findMany` for one table. Drizzle's own signature is what the
 * module under test sees; here it is a spy, and saying so once beats casting
 * at every call site.
 */
const findMany = (table: { findMany: unknown }): Mock => table.findMany as Mock;

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
	findMany(db.query.profile_versions).mockResolvedValue(VERSIONS);
	findMany(db.query.tech_skill_categories).mockResolvedValue(categories);
	findMany(db.query.work_experiences).mockResolvedValue([]);
}

/** Roles carrying a TECH line, for the templates that render one. */
function withRoles(
	roles: Array<{
		id: number;
		tags?: string[] | null;
		tech: Array<{ id: number; name: string; tags?: string[] | null }>;
	}>
) {
	findMany(db.query.work_experiences).mockResolvedValue(
		roles.map((r) => ({
			id: r.id,
			tags: r.tags ?? null,
			work_experience_technologies: r.tech.map((t) => ({ ...t, tags: t.tags ?? null }))
		}))
	);
}

function names(hidden: { name: string }[] | undefined): string[] {
	return (hidden ?? []).map((s) => s.name);
}

describe('getVersionCoverage — the hidden-skill view', () => {
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

describe('getVersionCoverage — a skill printed at a role', () => {
	beforeEach(() => vi.clearAllMocks());

	const HELD_BACK = [
		{
			id: 10,
			tags: null,
			tech_skills: [{ id: 100, name: 'Kubernetes', tags: PROFILE_ONLY }]
		}
	];

	it('is shown, not hidden, on a template that prints the tech line', async () => {
		// The applicant keeps it out of their skills block and records it where it
		// was used. A branded document prints that line, so the word is on the page
		// — and the button offered here would only have printed it twice.
		setup(HELD_BACK);
		withRoles([{ id: 1, tech: [{ id: 500, name: 'Kubernetes' }] }]);

		const coverage = await getVersionCoverage(1, ['Kubernetes'], { template: 'citrus' });

		expect(coverage[hiddenSkillsKey('resume', '')].hidden).toEqual([]);
		expect(coverage[hiddenSkillsKey('resume', '')].shown).toEqual(['Kubernetes']);
	});

	it('stays hidden on the layout that prints no technologies', async () => {
		setup(HELD_BACK);
		withRoles([{ id: 1, tech: [{ id: 500, name: 'Kubernetes' }] }]);

		for (const template of [null, 'default']) {
			const coverage = await getVersionCoverage(1, ['Kubernetes'], { template });
			expect(names(coverage[hiddenSkillsKey('resume', '')].hidden)).toEqual(['Kubernetes']);
		}
		// And it never asks for the roles it has no use for.
		expect(db.query.work_experiences.findMany).not.toHaveBeenCalled();
	});

	it('reads the tech line through the same filter the renderer uses', async () => {
		// A role held off this document takes its technologies with it, and a
		// technology tagged "CV only" is off the resume on its own account.
		setup(HELD_BACK);
		withRoles([
			{ id: 1, tags: ['cv'], tech: [{ id: 500, name: 'Kubernetes' }] },
			{ id: 2, tech: [{ id: 501, name: 'Kubernetes', tags: ['cv'] }] }
		]);

		const coverage = await getVersionCoverage(1, ['Kubernetes'], { template: 'citrus' });

		expect(names(coverage[hiddenSkillsKey('resume', '')].hidden)).toEqual(['Kubernetes']);
		// Both hold-backs are about the resume; the CV prints it either way.
		expect(coverage[hiddenSkillsKey('cv', '')].hidden).toEqual([]);
	});

	it('names a role’s technology as the carrier of a skill inside it', async () => {
		setup(HELD_BACK);
		withRoles([{ id: 1, tech: [{ id: 500, name: 'Kubernetes operators' }] }]);

		const coverage = await getVersionCoverage(1, ['Kubernetes'], { template: 'citrus' });

		expect(coverage[hiddenSkillsKey('resume', '')].hidden[0]).toMatchObject({
			name: 'Kubernetes',
			carriedBy: 'Kubernetes operators'
		});
	});
});
