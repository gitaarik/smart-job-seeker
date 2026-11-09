import { describe, expect, test, vi } from 'vitest';
import { render } from '@testing-library/svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/p/alex/portfolio') } }));

import ShowcaseSite from './ShowcaseSite.svelte';

// jsdom has no matchMedia; the layout reads it on mount for the system scheme.
vi.stubGlobal('matchMedia', () => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {}
}));

/**
 * How much of the career the showcase prints in full: Selected work, the
 * brief lists and the achievements cut-off. Which list each entry lands in
 * is site-lists.test.ts; this checks the markup carries it out.
 */

const achievements = (n: number) =>
	Array.from({ length: n }, (_, i) => ({ id: 100 + i, description: `Achievement ${i + 1}` }));

function site(config: Record<string, unknown> = {}) {
	const profile = {
		name: 'Alex Morgan',
		slug: 'alex',
		profile_versions: [],
		highlights: [],
		references: [],
		work_experiences: [
			{
				id: 1,
				name: 'NowCorp',
				position: 'Lead',
				start_date: '2024-01-01',
				end_date: null,
				work_experience_achievements: achievements(6),
				work_experience_technologies: [],
				work_experience_projects: [
					{
						id: 10,
						name: 'Payments rewrite',
						description: 'Rewrote the payments.',
						outcome: 'Checkout got faster.',
						featured: true,
						work_experience_project_technologies: []
					},
					{
						id: 11,
						name: 'Admin cleanup',
						description: 'Tidied the admin.',
						work_experience_project_technologies: [{ id: 1, name: 'Django', tags: null }]
					}
				]
			},
			{
				id: 2,
				name: 'OldCorp',
				position: 'Developer',
				start_date: '2008-01-01',
				end_date: '2012-06-30',
				work_experience_achievements: achievements(2),
				work_experience_technologies: [],
				work_experience_projects: []
			}
		],
		side_projects: [],
		email_address: null,
		phone_number: null
	};
	const theme = { id: 1, name: 'S', slug: 's', config: { layout: 'showcase' as const, ...config } };
	return render(ShowcaseSite, {
		props: { profile, theme, contact: { available: true, siteKey: 'k' } }
	}).container;
}

/** A card by its heading, which Card prints as the article's h2. */
function card(container: HTMLElement, title: string): HTMLElement | undefined {
	return [...container.querySelectorAll('article')].find((a) =>
		a.querySelector('h2')?.textContent?.includes(title)
	);
}

describe('ShowcaseSite career', () => {
	test('opens the career with Selected work, a slide per featured project and its whole story', () => {
		const c = site();
		const band = c.querySelector<HTMLElement>('.work-band');
		expect(band?.querySelector('h2')?.textContent).toContain('Selected Work');
		const work = card(c, 'Professional Experience');
		expect(band!.compareDocumentPosition(work!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

		const slide = band?.querySelector('[aria-roledescription="slide"]');
		expect(slide?.textContent).toContain('Payments rewrite');
		expect(slide?.textContent).toContain('NowCorp');

		// The whole write-up is on the page, its story closed until asked for.
		const story = band?.querySelector('.story');
		expect(story?.hasAttribute('hidden')).toBe(true);
		expect(story?.textContent).toContain('Rewrote the payments.');
		expect(story?.textContent).toContain('Checkout got faster.');
	});

	test('lists the other projects by name, their write-up behind a click', () => {
		const projects = card(site(), 'Projects');
		expect(projects?.textContent).not.toContain('Payments rewrite');

		const entry = projects?.querySelector('details');
		expect(entry?.querySelector('summary')?.textContent).toContain('Admin cleanup');
		expect(entry?.textContent).toContain('Tidied the admin.');
		expect(entry?.textContent).toContain('Django');
	});

	test("prints a role's first achievements and holds the rest behind a show more", () => {
		const work = card(site(), 'Professional Experience');
		const more = work?.querySelector('details.more-achievements');
		expect(more?.querySelector('summary')?.textContent).toContain('Show 2 more');
		expect(more?.textContent).toContain('Achievement 6');
		// The four before them are printed outside the disclosure.
		expect(more?.textContent).not.toContain('Achievement 4');
		expect(work?.textContent).toContain('Achievement 4');
	});

	test('prints an old role as one line under Earlier roles', () => {
		const work = card(site(), 'Professional Experience');
		const earlier = work?.querySelector('.brief-list');
		expect(earlier?.textContent).toContain('Earlier roles');
		expect(earlier?.textContent).toContain('Developer');
		expect(earlier?.textContent).toContain('OldCorp');
		expect(earlier?.textContent).not.toContain('Achievement');
	});

	test('a theme set to print everything prints everything', () => {
		const work = card(
			site({ briefRolesAfterYears: 'never', achievementsPerRole: 'all' }),
			'Professional Experience'
		);
		expect(work?.querySelector('details')).toBeNull();
		expect(work?.querySelector('.brief-list')).toBeNull();
	});
});
