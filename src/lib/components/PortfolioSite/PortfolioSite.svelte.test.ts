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
