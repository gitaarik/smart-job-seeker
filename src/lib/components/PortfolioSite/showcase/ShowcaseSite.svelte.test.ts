import { describe, expect, test, vi } from 'vitest';
import { render } from '@testing-library/svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/p/alex/portfolio') } }));

import ShowcaseSite from './ShowcaseSite.svelte';
import type { PortfolioBusiness } from '$lib/server/profile/portfolio-business';

// jsdom has no matchMedia; the layout reads it on mount for the system scheme.
vi.stubGlobal('matchMedia', () => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {}
}));

/**
 * What the showcase prints from a profile. The contact details are not in its
 * input at all (the load nulls them), so these check the layout's own logic:
 * which highlights go where, what a section with nothing renders, and that
 * an owner-typed link that is not a web link never becomes an href.
 */
function site(
	over: Record<string, unknown> = {},
	config: Record<string, unknown> = {},
	business: PortfolioBusiness | null = null
) {
	const profile = {
		name: 'Alex Morgan',
		slug: 'alex',
		title: 'Engineer',
		about_me_text: 'First paragraph.\n\nSecond paragraph.',
		profile_versions: [],
		highlights: [
			{ id: 1, type: 'highlight', text: 'Shipped things', fa_icon: 'rocket' },
			{ id: 2, type: 'key_skill', text: 'An old key skill row', icon_name: 'faPython' },
			{ id: 3, type: 'contact_for', text: 'Consulting', icon_name: 'faUsers' }
		],
		work_experiences: [],
		references: [],
		email_address: null,
		phone_number: null,
		...over
	};
	const theme = {
		id: 1,
		name: 'S',
		slug: 's',
		config: { layout: 'showcase' as const, ...config }
	};
	return render(ShowcaseSite, {
		props: { profile, theme, contact: { available: true, siteKey: 'k' }, business }
	}).container;
}

/** One of the boxes beside the About me, by its heading. */
const box = (c: HTMLElement, label: string) =>
	[...c.querySelectorAll('h3')].find((h) => h.textContent?.trim() === label)?.parentElement;

describe('ShowcaseSite', () => {
	test('links only the bracketed words of the footer note', () => {
		const c = site(
			{},
			{
				footerNote: 'Logo Vector by [Vecteezy]',
				footerNoteUrl: 'https://www.vecteezy.com/free-vector/logo'
			}
		);
		const link = c.querySelector('footer a[href="https://www.vecteezy.com/free-vector/logo"]');
		expect(link?.textContent).toBe('Vecteezy');
		expect(link?.parentElement?.textContent?.trim()).toBe('Logo Vector by Vecteezy');
	});

	test('prints the business block in the footer in place of the name, title and place', () => {
		const footer = (c: HTMLElement) => c.querySelector('footer')?.textContent ?? '';
		const own = site({
			location: 'Utrecht',
			personal_website: 'https://alex.example',
			github_profile: 'https://github.com/alex'
		});
		const plain = footer(own);
		// The site's own address is not a link out of it.
		expect(own.querySelector('footer a[href="https://alex.example"]')).toBeNull();
		expect(own.querySelector('footer a[href="https://github.com/alex"]')).not.toBeNull();
		expect(plain).toContain('Alex Morgan');
		expect(plain).toContain('Engineer');

		const c = site(
			{ location: 'Utrecht' },
			{},
			{
				name: 'Morgan Software',
				street: 'Keizersgracht 1',
				place: '1015 AA Amsterdam',
				country: 'Netherlands',
				vatId: 'NL001234567B01',
				registration: '12345678',
				registrationLabel: 'KVK'
			}
		);
		const text = footer(c);
		expect(c.querySelector('#pf-footer')?.textContent).toBe('Morgan Software');
		for (const part of [
			'Keizersgracht 1',
			'1015 AA Amsterdam',
			'Netherlands',
			'VAT ID: NL001234567B01',
			'KVK: 12345678'
		]) {
			expect(text).toContain(part);
		}
		expect(text).not.toContain('Utrecht');
		expect(text).toContain(`Copyright © ${new Date().getFullYear()} Morgan Software`);
	});

	test("prints a project's own role under its name, and nothing for one without", () => {
		const c = site({
			work_experiences: [
				{
					id: 1,
					name: 'TechCorp',
					position: 'Engineer',
					work_experience_achievements: [],
					work_experience_technologies: [],
					work_experience_projects: [
						{
							id: 2,
							name: 'Scan app',
							project_role: 'Architect',
							work_experience_project_technologies: []
						},
						{
							id: 3,
							name: 'Test suite',
							project_role: null,
							work_experience_project_technologies: []
						}
					]
				}
			],
			side_projects: [
				{
					id: 4,
					name: 'Django',
					project_role: 'Contributor',
					side_project_achievements: [],
					side_project_technologies: []
				}
			]
		});
		const titled = (name: string) =>
			[...c.querySelectorAll('h3')].find((h) => h.textContent?.trim() === name);

		const scanCard = titled('Scan app')?.closest('div.role-project');
		expect(scanCard?.textContent).toContain('Architect');
		expect(titled('Test suite')?.closest('div.role-project')?.textContent).not.toContain(
			'Architect'
		);
		expect(titled('Django')?.closest('header')?.textContent).toContain('Contributor');
	});

	test('splits highlights: contact-for beside the About me, the rest as a card', () => {
		const c = site();
		expect(box(c, 'Services:')?.textContent).toContain('Consulting');
		const card = [...c.querySelectorAll('article')].find((a) =>
			a.querySelector(':scope > h2')?.textContent?.includes('Highlights')
		);
		expect(card?.textContent).toContain('Shipped things');
		expect(card?.textContent).not.toContain('Consulting');
	});

	test('the Key skills box is the Skills, a line per group, and never a key_skill row', () => {
		const c = site({
			tech_skill_categories: [
				{
					id: 1,
					name: 'Backend',
					fa_icon: 'python',
					tech_skills: [
						{ id: 10, name: 'Python' },
						{ id: 11, name: 'Django' }
					]
				},
				{ id: 2, name: 'AI', tech_skills: [{ id: 20, name: 'RAG' }] }
			]
		});
		const lines = [...(box(c, 'Key skills:')?.querySelectorAll('li') ?? [])];
		expect(lines.map((li) => li.textContent?.trim())).toEqual(['Python, Django', 'RAG']);
		expect(lines[0].querySelector('svg')).not.toBeNull();
		// The group with no icon keeps the gap, so both lines start in one column.
		expect(lines[1].querySelector('span[aria-hidden="true"]')).not.toBeNull();
		expect(c.textContent).not.toContain('An old key skill row');
	});

	test('a profile with no skills has no Key skills box', () => {
		const c = site();
		expect(box(c, 'Key skills:')).toBeUndefined();
		expect(c.textContent).not.toContain('An old key skill row');
	});

	test('with both boxes, Key skills takes the wider column', () => {
		const grid = (c: HTMLElement) => box(c, 'Services:')?.parentElement?.className ?? '';
		const both = site({
			tech_skill_categories: [{ id: 1, name: 'Backend', tech_skills: [{ id: 10, name: 'Go' }] }]
		});
		expect(grid(both)).toContain('grid-cols-[3fr_2fr]');
		// One box alone keeps half the row, as both used to.
		expect(grid(site())).toContain('min-[50rem]:grid-cols-2');
		expect(grid(site())).not.toContain('3fr');
	});

	test('the About me is one paragraph per blank-line block', () => {
		const ps = [...site().querySelectorAll('section p')].map((p) => p.textContent?.trim());
		expect(ps).toContain('First paragraph.');
		expect(ps).toContain('Second paragraph.');
	});

	test('a section with nothing in it renders no heading', () => {
		expect(site().textContent).not.toContain('Professional Experience');
	});

	test("a theme's heading replaces the layout's", () => {
		const c = site(
			{ references: [{ id: 1, text: 'Great.', author: 'Sam' }] },
			{ titles: { references: 'What Clients Say' } }
		);
		expect(c.textContent).toContain('What Clients Say');
		expect(c.textContent).not.toContain('What People Say');
	});

	test('plainQuotes takes the quotes off the coloured band', () => {
		const band = (config: Record<string, unknown>) =>
			site({ references: [{ id: 1, text: 'Great.', author: 'Sam' }] }, config).querySelector(
				'[aria-labelledby="pf-references"]'
			);
		expect(band({})?.classList.contains('plain-quotes')).toBe(false);
		expect(band({ plainQuotes: true })?.classList.contains('plain-quotes')).toBe(true);
	});

	test('a link that is not a web link is not rendered as one', () => {
		const c = site({
			linkedin_profile: 'javascript:alert(1)',
			github_profile: 'https://github.com/a'
		});
		const hrefs = [...c.querySelectorAll('a')].map((a) => a.getAttribute('href'));
		expect(hrefs).toContain('https://github.com/a');
		expect(hrefs.some((h) => h?.startsWith('javascript:'))).toBe(false);
	});

	test('offers the contact button without printing any details', () => {
		const c = site();
		expect(c.textContent).toContain('Get in touch');
		expect(c.querySelector('a[href^="mailto:"]')).toBeNull();
		expect(c.querySelector('a[href^="tel:"]')).toBeNull();
	});

	const buttons = (c: HTMLElement) =>
		[...c.querySelectorAll('button')].filter((b) => b.textContent?.includes('Get in touch'));

	test('ends on a contact button when something follows the About me', () => {
		const c = site({ references: [{ id: 1, text: 'Great.', author: 'Sam' }] });
		expect(c.querySelector('#pf-closing')).not.toBeNull();
		expect(buttons(c)).toHaveLength(3);
	});

	test('adds no closing button when the About me, with its own, is last', () => {
		const c = site({}, { sections: ['header', 'about'] });
		expect(c.querySelector('#pf-closing')).toBeNull();
		expect(buttons(c)).toHaveLength(2);
	});
});
