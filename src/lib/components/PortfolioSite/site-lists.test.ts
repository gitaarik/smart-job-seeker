import { describe, expect, test } from 'vitest';
import { careerDetail, type PortfolioPage, type PortfolioThemeConfig } from '$lib/portfolio-themes';
import {
	careerView,
	isBriefRole,
	siteLists,
	splitAchievements,
	type Row,
	type SiteLists
} from './site-lists';

/**
 * What the career prints in full and what it lists briefly. The profile that
 * asked for this printed about 5,500 words, most of it every project's full
 * write-up and every achievement of every role back to 2013.
 */

const TODAY = new Date('2026-11-09');

function role(id: number, end: string | null, projects: Row[] = []): Row {
	return {
		id,
		name: `Company ${id}`,
		position: 'Engineer',
		start_date: '2010-01-01',
		end_date: end,
		work_experience_achievements: [],
		work_experience_technologies: [],
		work_experience_projects: projects
	};
}

function project(id: number, over: Row = {}): Row {
	return { id, name: `Project ${id}`, work_experience_project_technologies: [], ...over };
}

function view(profile: Row, config: PortfolioThemeConfig = {}, page: PortfolioPage = 'site') {
	const lists = siteLists({ profile_versions: [], side_projects: [], ...profile }, null);
	return { lists, view: careerView(lists, config, TODAY, page) };
}

const names = (rows: Row[]) => rows.map((r) => r.name);

/** Selected work as [kind, name] pairs, whichever kind each entry is. */
const picks = (featured: SiteLists['featured']) =>
	featured.map((f) => [f.kind, f.kind === 'experience' ? f.role.name : f.project.name]);

describe('isBriefRole', () => {
	test('a role that ended longer ago than the cutoff is a line, a current one never is', () => {
		expect(isBriefRole(role(1, '2015-06-26'), 10, TODAY)).toBe(true);
		expect(isBriefRole(role(1, '2017-01-01'), 10, TODAY)).toBe(false);
		expect(isBriefRole(role(1, null), 10, TODAY)).toBe(false);
		expect(isBriefRole(role(1, '2015-06-26'), 'never', TODAY)).toBe(false);
	});
});

describe('splitAchievements', () => {
	const five = [1, 2, 3, 4, 5];

	test('prints the first ones in the order given and holds the rest back', () => {
		expect(splitAchievements(five, 3)).toEqual({ shown: [1, 2, 3], more: [4, 5] });
	});

	test('prints a single leftover rather than hiding one line behind a click', () => {
		expect(splitAchievements([1, 2, 3, 4], 3)).toEqual({ shown: [1, 2, 3, 4], more: [] });
	});

	test('`all` prints every one', () => {
		expect(splitAchievements(five, 'all')).toEqual({ shown: five, more: [] });
	});
});

describe('careerDetail', () => {
	test('fills in the defaults, and reads nonsense as the default', () => {
		expect(careerDetail({})).toEqual({ briefRolesAfterYears: 10, achievementsPerRole: 4 });
		expect(
			careerDetail({
				briefRolesAfterYears: -2,
				achievementsPerRole: 'some' as never
			})
		).toEqual({ briefRolesAfterYears: 10, achievementsPerRole: 4 });
		expect(careerDetail({ briefRolesAfterYears: 'never', achievementsPerRole: 'all' })).toEqual({
			briefRolesAfterYears: 'never',
			achievementsPerRole: 'all'
		});
	});
});

describe('careerView', () => {
	const profile = {
		work_experiences: [
			role(1, null, [project(10, { featured: true }), project(11)]),
			role(2, '2025-03-07', [project(20)]),
			role(3, '2014-08-08', [project(30)])
		],
		side_projects: [
			{ id: 40, name: 'Side A', featured: true, side_project_technologies: [] },
			{ id: 41, name: 'Side B', side_project_technologies: [] }
		]
	};

	test('moves the featured projects to Selected work and lists every other project briefly', () => {
		const { lists, view: v } = view(profile);

		expect(v.selectedWork).toBe(true);
		expect(picks(lists.featured)).toEqual([
			['role', 'Project 10'],
			['side', 'Side A']
		]);
		expect(v.fullProjects).toEqual([]);
		expect(names(v.briefProjects)).toEqual(['Project 11', 'Project 20', 'Project 30']);
		expect(v.fullSideProjects).toEqual([]);
		expect(names(v.briefSideProjects)).toEqual(['Side B']);
	});

	test('prints an old role as a line, and the recent ones in full', () => {
		const { view: v } = view(profile);
		expect(v.fullRoles.map((r) => r.id)).toEqual([1, 2]);
		expect(v.briefRoles.map((r) => r.id)).toEqual([3]);
	});

	test('without anything featured, prints projects in full except an old role’s', () => {
		const unfeatured = {
			work_experiences: [role(1, null, [project(10)]), role(3, '2014-08-08', [project(30)])]
		};
		const { view: v } = view(unfeatured);

		expect(v.selectedWork).toBe(false);
		expect(names(v.fullProjects)).toEqual(['Project 10']);
		expect(names(v.briefProjects)).toEqual(['Project 30']);
	});

	test('a theme that left Selected work out keeps featured projects where they were', () => {
		const { view: v } = view(profile, { sections: ['header', 'work', 'projects', 'sideProjects'] });

		expect(v.selectedWork).toBe(false);
		expect(names(v.fullProjects)).toEqual(['Project 10', 'Project 11', 'Project 20']);
		expect(names(v.fullSideProjects)).toEqual(['Side A', 'Side B']);
	});

	test('a featured project switched off the site is not featured on it', () => {
		const { lists } = view({
			work_experiences: [role(1, null, [project(10, { featured: true, tags: ['!portfolio'] })])]
		});
		expect(lists.featured).toEqual([]);
	});

	describe('a featured role', () => {
		test('joins Selected work where the career has it, before its own projects', () => {
			const { lists } = view({
				work_experiences: [
					{ ...role(1, null, [project(10, { featured: true })]), featured: true },
					role(2, '2025-03-07', [project(20, { featured: true })])
				],
				side_projects: [{ id: 40, name: 'Side A', featured: true, side_project_technologies: [] }]
			});
			expect(picks(lists.featured)).toEqual([
				['experience', 'Company 1'],
				['role', 'Project 10'],
				['role', 'Project 20'],
				['side', 'Side A']
			]);
		});

		test('stays in the career, and on its own is enough to list the projects briefly', () => {
			const { view: v } = view({
				work_experiences: [
					{ ...role(1, null, [project(10)]), featured: true },
					role(2, '2025-03-07', [project(20)])
				]
			});
			expect(v.selectedWork).toBe(true);
			expect(v.fullRoles.map((r) => r.id)).toEqual([1, 2]);
			expect(v.fullProjects).toEqual([]);
			expect(names(v.briefProjects)).toEqual(['Project 10', 'Project 20']);
		});

		test('prints in full however long ago it ended, unless the theme left Selected work out', () => {
			const profile = {
				work_experiences: [
					role(1, null),
					{ ...role(3, '2014-08-08'), featured: true },
					role(4, '2012-01-01')
				]
			};
			const { view: v } = view(profile);
			expect(v.fullRoles.map((r) => r.id)).toEqual([1, 3]);
			expect(v.briefRoles.map((r) => r.id)).toEqual([4]);

			const { view: plain } = view(profile, { sections: ['header', 'work'] });
			expect(plain.briefRoles.map((r) => r.id)).toEqual([3, 4]);
		});

		test('switched off the site is not featured on it', () => {
			const { lists } = view({
				work_experiences: [{ ...role(1, null), featured: true, tags: ['!portfolio'] }]
			});
			expect(lists.featured).toEqual([]);
		});
	});

	test('`never` prints every role in full', () => {
		const { view: v } = view(profile, { briefRolesAfterYears: 'never' });
		expect(v.briefRoles).toEqual([]);
	});

	describe('on the private CV page', () => {
		test('prints each featured project in full in its own section, and no Selected work', () => {
			const { view: v } = view(profile, {}, 'cv');

			expect(v.selectedWork).toBe(false);
			expect(names(v.fullProjects)).toEqual(['Project 10']);
			expect(names(v.briefProjects)).toEqual(['Project 11', 'Project 20', 'Project 30']);
			expect(names(v.fullSideProjects)).toEqual(['Side A']);
			expect(names(v.briefSideProjects)).toEqual(['Side B']);
		});

		test('without anything featured, prints projects as the one-page site does', () => {
			const unfeatured = {
				work_experiences: [role(1, null, [project(10)]), role(3, '2014-08-08', [project(30)])]
			};
			expect(view(unfeatured, {}, 'cv').view).toEqual(view(unfeatured).view);
		});

		test('a theme that left Selected work out prints every project in full, as on one page', () => {
			const sections: PortfolioThemeConfig['sections'] = ['header', 'work', 'projects'];
			expect(view(profile, { sections }, 'cv').view).toEqual(view(profile, { sections }).view);
		});
	});
});
