import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import PortfolioSite from './PortfolioSite.svelte';

/**
 * Which technologies the public site lists.
 *
 * The site is the only page that prints a role project's or a side project's
 * technologies, so their Site switch (`!portfolio`) does nothing unless this
 * renderer reads it. A role's technologies go through the same filter, and the
 * document pair (`!resume` + `!cv`) is not the site's business.
 */

type Tech = { id: number; name: string; tags: string[] | null };

function siteFor(techs: { role?: Tech[]; project?: Tech[]; side?: Tech[] }) {
	const profile = {
		name: 'Alex Morgan',
		profile_versions: [],
		work_experiences: [
			{
				id: 1,
				position: 'Engineer',
				name: 'TechCorp',
				work_experience_achievements: [],
				work_experience_technologies: techs.role ?? [],
				work_experience_projects: [
					{
						id: 2,
						name: 'Payments rewrite',
						work_experience_project_technologies: techs.project ?? []
					}
				]
			}
		],
		side_projects: [
			{
				id: 3,
				name: 'Recipe Finder',
				side_project_achievements: [],
				side_project_technologies: techs.side ?? []
			}
		]
	};
	const { container } = render(PortfolioSite, { props: { profile, theme: null } });
	return container;
}

/** The technology names listed under an entry, by its heading. */
function listedUnder(container: HTMLElement, heading: string): string[] | null {
	const entry = [...container.querySelectorAll('article.entry')].find((a) =>
		a.querySelector('h3')?.textContent?.includes(heading)
	);
	const list = entry?.querySelector('ul.tags');
	return list ? [...list.querySelectorAll('li')].map((li) => li.textContent?.trim() ?? '') : null;
}

describe('PortfolioSite technologies', () => {
	test('leaves a technology switched off the site out of all three lists', () => {
		const off = ['!portfolio'];
		const site = siteFor({
			role: [
				{ id: 10, name: 'TypeScript', tags: null },
				{ id: 11, name: 'Perl', tags: off }
			],
			project: [
				{ id: 20, name: 'Stripe', tags: null },
				{ id: 21, name: 'SOAP', tags: off }
			],
			side: [
				{ id: 30, name: 'Svelte', tags: null },
				{ id: 31, name: 'jQuery', tags: off }
			]
		});

		expect(listedUnder(site, 'Engineer')).toEqual(['TypeScript']);
		expect(listedUnder(site, 'Payments rewrite')).toEqual(['Stripe']);
		expect(listedUnder(site, 'Recipe Finder')).toEqual(['Svelte']);
	});

	test('keeps a technology held back from the documents only', () => {
		const site = siteFor({ side: [{ id: 30, name: 'Redis', tags: ['!resume', '!cv'] }] });

		expect(listedUnder(site, 'Recipe Finder')).toEqual(['Redis']);
	});

	test('prints no empty list when every technology is off the site', () => {
		const off = ['!portfolio'];
		const site = siteFor({
			role: [{ id: 11, name: 'Perl', tags: off }],
			project: [{ id: 21, name: 'SOAP', tags: off }],
			side: [{ id: 31, name: 'jQuery', tags: off }]
		});

		expect(listedUnder(site, 'Engineer')).toBeNull();
		expect(listedUnder(site, 'Payments rewrite')).toBeNull();
		expect(listedUnder(site, 'Recipe Finder')).toBeNull();
	});
});

describe('PortfolioSite role projects', () => {
	/** The headings of the entries the site prints, for a role with these projects. */
	function headingsFor(projects: { id: number; name: string; tags: string[] | null }[]) {
		const profile = {
			name: 'Alex Morgan',
			profile_versions: [],
			work_experiences: [
				{
					id: 1,
					position: 'Engineer',
					name: 'TechCorp',
					work_experience_achievements: [],
					work_experience_technologies: [],
					work_experience_projects: projects.map((p) => ({
						...p,
						work_experience_project_technologies: []
					}))
				}
			],
			side_projects: []
		};
		const { container } = render(PortfolioSite, { props: { profile, theme: null } });
		return [...container.querySelectorAll('article.entry h3')].map(
			(h) => h.textContent?.trim() ?? ''
		);
	}

	test('leaves a project switched off the site out, and keeps one held back from the documents only', () => {
		const headings = headingsFor([
			{ id: 2, name: 'Payments rewrite', tags: null },
			{ id: 3, name: 'Vendor assessment', tags: ['!portfolio'] },
			{ id: 4, name: 'Internal tooling', tags: ['!resume', '!cv'] }
		]);
		expect(headings.some((h) => h.includes('Payments rewrite'))).toBe(true);
		expect(headings.some((h) => h.includes('Internal tooling'))).toBe(true);
		expect(headings.some((h) => h.includes('Vendor assessment'))).toBe(false);
	});
});

describe("PortfolioSite projects: the applicant's own role", () => {
	function siteWithRoles(roles: { project?: string; side?: string }) {
		const profile = {
			name: 'Alex Morgan',
			profile_versions: [],
			work_experiences: [
				{
					id: 1,
					position: 'Engineer',
					name: 'TechCorp',
					work_experience_achievements: [],
					work_experience_technologies: [],
					work_experience_projects: [
						{
							id: 2,
							name: 'Payments rewrite',
							project_role: roles.project ?? null,
							work_experience_project_technologies: []
						}
					]
				}
			],
			side_projects: [
				{
					id: 3,
					name: 'Recipe Finder',
					project_role: roles.side ?? null,
					start_date: '2021-01-01',
					end_date: '2022-06-01',
					repo_url: 'https://github.com/alex/recipes',
					side_project_achievements: [],
					side_project_technologies: []
				}
			]
		};
		const { container } = render(PortfolioSite, { props: { profile, theme: null } });
		return container;
	}

	/** An entry's meta line as it reads, whitespace collapsed the way a browser shows it. */
	function metaUnder(container: HTMLElement, heading: string): string | undefined {
		const entry = [...container.querySelectorAll('article.entry')].find((a) =>
			a.querySelector('h3')?.textContent?.includes(heading)
		);
		return entry?.querySelector('p.meta')?.textContent?.replace(/\s+/g, ' ').trim();
	}

	test("puts a role project's role before its company, and the company alone without one", () => {
		expect(metaUnder(siteWithRoles({ project: 'Tech lead' }), 'Payments rewrite')).toBe(
			'Tech lead · TechCorp'
		);
		expect(metaUnder(siteWithRoles({}), 'Payments rewrite')).toBe('TechCorp');
	});

	test("puts a side project's role before its dates", () => {
		const withRole = metaUnder(siteWithRoles({ side: 'Contributor' }), 'Recipe Finder');
		const without = metaUnder(siteWithRoles({}), 'Recipe Finder');

		expect(withRole).toBe(`Contributor · ${without}`);
		expect(without).toMatch(/^Jan 2021/);
	});
});

describe('PortfolioSite separators', () => {
	// Svelte drops the whitespace a block starts with, so a " · " written
	// inside {#if} printed as "Engineer· TechCorp" until 2026-10-24.
	function rendered(sideProject: Record<string, unknown>) {
		const profile = {
			name: 'Alex Morgan',
			profile_versions: [],
			work_experiences: [
				{
					id: 1,
					position: 'Engineer',
					name: 'TechCorp',
					location: 'Utrecht',
					start_date: '2020-01-01',
					end_date: '2022-01-01',
					work_experience_achievements: [],
					work_experience_technologies: [],
					work_experience_projects: []
				}
			],
			side_projects: [
				{
					id: 3,
					name: 'Recipe Finder',
					side_project_achievements: [],
					side_project_technologies: [],
					...sideProject
				}
			]
		};
		const { container } = render(PortfolioSite, { props: { profile, theme: null } });
		const entry = (heading: string) =>
			[...container.querySelectorAll('article.entry')].find((a) =>
				a.querySelector('h3')?.textContent?.includes(heading)
			);
		const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();
		return { entry, text };
	}

	test("keeps the space before a role's employer and its location", () => {
		const { entry, text } = rendered({});
		const role = entry('Engineer');
		expect(text(role?.querySelector('h3'))).toBe('Engineer · TechCorp');
		expect(text(role?.querySelector('p.meta'))).toMatch(/2022 · Utrecht$/);
	});

	test("keeps the space before a side project's source link, and drops the dot when nothing precedes it", () => {
		const repo = { repo_url: 'https://github.com/alex/recipes' };
		const dated = rendered({ ...repo, start_date: '2021-01-01', end_date: '2022-06-01' });
		expect(dated.text(dated.entry('Recipe Finder')?.querySelector('p.meta'))).toMatch(
			/2022 · source$/
		);

		const bare = rendered(repo);
		expect(bare.text(bare.entry('Recipe Finder')?.querySelector('p.meta'))).toBe('source');
	});
});

describe('PortfolioSite — where a role was done', () => {
	function metaFor(role: { location: string; work_mode: string | null }) {
		const profile = {
			name: 'Alex Morgan',
			profile_versions: [],
			work_experiences: [
				{
					id: 1,
					position: 'Engineer',
					name: 'TechCorp',
					start_date: '2024-10-01',
					end_date: null,
					...role,
					work_experience_achievements: [],
					work_experience_technologies: [],
					work_experience_projects: []
				}
			],
			side_projects: []
		};
		const { container } = render(PortfolioSite, { props: { profile, theme: null } });
		return container.querySelector('article.entry p.meta')?.textContent?.trim() ?? '';
	}

	test('puts the work mode after the place, and nothing for on-site', () => {
		expect(metaFor({ location: 'Austin, US', work_mode: 'remote' })).toMatch(
			/ · Austin, US \(remote\)$/
		);
		expect(metaFor({ location: 'Utrecht, NL', work_mode: 'onsite' })).toMatch(/ · Utrecht, NL$/);
	});
});

describe('PortfolioSite career detail', () => {
	/**
	 * The basic layout follows the same `careerView` as the showcase: the
	 * featured projects under Selected work, the rest a line each, an old role
	 * a line under Earlier roles, and a role's achievements cut at four.
	 */
	function career(roleOver: Record<string, unknown> = {}) {
		const profile = {
			name: 'Alex Morgan',
			profile_versions: [],
			work_experiences: [
				{
					...roleOver,
					id: 1,
					position: 'Lead',
					name: 'NowCorp',
					start_date: '2024-01-01',
					end_date: null,
					work_experience_achievements: [1, 2, 3, 4, 5, 6].map((n) => ({
						id: 100 + n,
						description: `Achievement ${n}`
					})),
					work_experience_technologies: [],
					work_experience_projects: [
						{
							id: 10,
							name: 'Payments rewrite',
							featured: true,
							work_experience_project_technologies: []
						},
						{
							id: 11,
							name: 'Admin cleanup',
							description: 'Tidied the admin.',
							work_experience_project_technologies: []
						}
					]
				},
				{
					id: 2,
					position: 'Developer',
					name: 'OldCorp',
					start_date: '2008-01-01',
					end_date: '2012-06-30',
					work_experience_achievements: [],
					work_experience_technologies: [],
					work_experience_projects: []
				}
			],
			side_projects: []
		};
		const { container } = render(PortfolioSite, { props: { profile, theme: null } });
		return container;
	}

	/** A section by its heading. */
	function section(container: HTMLElement, title: string) {
		return [...container.querySelectorAll('section')].find(
			(s) => s.querySelector('h2')?.textContent === title
		);
	}

	test('prints the featured project under Selected work and the others as a line', () => {
		const site = career();
		expect(section(site, 'Selected work')?.textContent).toContain('Payments rewrite');

		const projects = section(site, 'Projects');
		expect(projects?.textContent).not.toContain('Payments rewrite');
		expect(projects?.querySelector('details summary')?.textContent).toContain('Admin cleanup');
	});

	test('prints a featured role under Selected work as a teaser, and whole under Experience', () => {
		const site = career({ featured: true, summary: 'Led the platform team.' });
		const picked = section(site, 'Selected work');
		const entries = [...(picked?.querySelectorAll('article.entry') ?? [])];
		// Where the career has it: the role, then its own featured project.
		expect(entries.map((a) => a.querySelector('h3')?.textContent?.trim())).toEqual([
			'Lead · NowCorp',
			'Payments rewrite'
		]);
		expect(entries[0].textContent).toContain('Led the platform team.');
		expect([...entries[0].querySelectorAll('ul.bullets li')].map((li) => li.textContent)).toEqual([
			'Achievement 1',
			'Achievement 2'
		]);

		const work = section(site, 'Experience');
		expect(work?.textContent).toContain('NowCorp');
		expect(work?.textContent).toContain('Achievement 4');
	});

	test('holds back all but four achievements and prints an old role as a line', () => {
		const work = section(career(), 'Experience');
		expect(work?.querySelector('details.more summary')?.textContent).toContain('Show 2 more');
		expect(work?.querySelector('.brief-heading')?.textContent).toBe('Earlier roles');
		expect(work?.querySelector('.brief-list')?.textContent).toContain('OldCorp');
	});
});
