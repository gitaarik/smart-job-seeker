import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/p/alex/portfolio') } }));

import ShowcaseSite from './ShowcaseSite.svelte';
import type { PortfolioPage } from '$lib/portfolio-themes';

// jsdom has no matchMedia, and no scrolling: the layout reads the first on
// mount, and the carousel moves with the other two.
vi.stubGlobal('matchMedia', () => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {}
}));
Element.prototype.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

/**
 * A showcase with a private CV page draws two pages from one layout: the
 * public one keeps the introduction, the quotes and Selected work, the CV page
 * the career. Which data each page carries is portfolio-pages.test.ts; this
 * checks what each draws, and the menu between them.
 */

function site(page: PortfolioPage, hrefs: { homeHref?: string; cvHref?: string } = {}) {
	const profile = {
		name: 'Alex Morgan',
		slug: 'alex',
		title: 'Engineer',
		about_me_text: 'About me.',
		summary: 'A CV summary.',
		profile_versions: [],
		highlights: [],
		references: [{ id: 5, author: 'Sam', text: 'Great to work with.' }],
		work_experiences: [
			{
				id: 1,
				name: 'NowCorp',
				position: 'Lead',
				start_date: '2024-01-01',
				work_experience_achievements: [{ id: 100, description: 'Cut costs 40%' }],
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
					{ id: 11, name: 'Admin cleanup', description: 'Tidied the admin.' }
				]
			}
		],
		side_projects: [],
		email_address: null,
		phone_number: null
	};
	const theme = {
		id: 1,
		name: 'S',
		slug: 's',
		config: { layout: 'showcase' as const, privateCv: true }
	};
	return render(ShowcaseSite, {
		props: { profile, theme, contact: { available: false, siteKey: null }, page, ...hrefs }
	}).container;
}

const headings = (c: HTMLElement) =>
	[...c.querySelectorAll('h2')].map((h) => h.textContent?.trim());

describe('ShowcaseSite pages', () => {
	test('the public page: the introduction, the quotes and Selected work, and no career', () => {
		const c = site('home');
		expect(headings(c)).toEqual(['About me', 'What People Say', 'Selected Work']);
		expect(c.querySelector('#pf-name')?.textContent).toBe('Alex Morgan');
		expect(c.textContent).not.toContain('Cut costs 40%');
		expect(c.textContent).not.toContain('Admin cleanup');
	});

	test('the CV page: its own header and the whole career, the featured project in full', () => {
		const c = site('cv');
		expect(c.querySelector('.cv-head')?.textContent).toContain('Full CV');
		expect(headings(c)).toEqual(['Summary', 'Professional Experience', 'Projects']);
		expect(c.textContent).toContain('Cut costs 40%');
		// In full in its own section, the rest a line each.
		const projects = [...c.querySelectorAll('article')].find((a) =>
			a.querySelector('h2')?.textContent?.includes('Projects')
		);
		expect(projects?.textContent).toContain('Checkout got faster.');
		expect(projects?.querySelector('details summary')?.textContent).toContain('Admin cleanup');
		expect(c.querySelector('.work-band')).toBeNull();
		expect(c.textContent).not.toContain('About me.');
	});

	test('no menu, and no word of the CV page, for a visitor who may open only one page', () => {
		const c = site('home');
		expect(c.querySelector('nav')).toBeNull();
		expect(c.querySelector('a.all-work')).toBeNull();
	});

	test('a menu between the two for a visitor who may open both', () => {
		const c = site('home', { homeHref: '/p/alex/portfolio', cvHref: '/p/alex/portfolio/cv' });
		const links = [...c.querySelectorAll<HTMLAnchorElement>('nav a')];
		expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
			['Home', '/p/alex/portfolio'],
			['Full CV', '/p/alex/portfolio/cv']
		]);
		expect(links[0].getAttribute('aria-current')).toBe('page');
		// And from under Selected work, where a reader looks for more.
		expect(c.querySelector('.work-band a.all-work')?.getAttribute('href')).toBe(
			'/p/alex/portfolio/cv'
		);
	});

	test('the one-page site draws everything, and no menu', () => {
		const c = site('site', { homeHref: '/h', cvHref: '/c' });
		expect(headings(c)).toContain('Selected Work');
		expect(headings(c)).toContain('Professional Experience');
		expect(c.querySelector('nav')).toBeNull();
	});
});

describe('Selected work carousel', () => {
	test('opens the story of the slide in view, and closes it again', async () => {
		const c = site('home');
		const story = c.querySelector('.story');
		const open = c.querySelector<HTMLButtonElement>('.slide.is-active .slide-more');
		expect(open?.getAttribute('aria-expanded')).toBe('false');

		await fireEvent.click(open!);
		await tick();
		expect(story?.hasAttribute('hidden')).toBe(false);
		expect(open?.getAttribute('aria-expanded')).toBe('true');
		expect(open?.textContent).toContain('Close the story');

		await fireEvent.click(open!);
		await tick();
		expect(story?.hasAttribute('hidden')).toBe(true);
	});
});
