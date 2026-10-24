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
 * What the showcase prints from a profile. The contact details are not in its
 * input at all (the load nulls them), so these check the layout's own logic:
 * which highlights go where, what a section with nothing renders, and that
 * an owner-typed link that is not a web link never becomes an href.
 */
function site(over: Record<string, unknown> = {}, config: Record<string, unknown> = {}) {
	const profile = {
		name: 'Alex Morgan',
		slug: 'alex',
		title: 'Engineer',
		about_me_text: 'First paragraph.\n\nSecond paragraph.',
		profile_versions: [],
		highlights: [
			{ id: 1, type: 'highlight', text: 'Shipped things', fa_icon: 'rocket' },
			{ id: 2, type: 'key_skill', text: 'Python, Django', icon_name: 'faPython' },
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
		props: { profile, theme, contact: { available: true, siteKey: 'k' } }
	}).container;
}

describe('ShowcaseSite', () => {
	test('splits highlights: key skills and contact-for beside the About me, the rest as a card', () => {
		const c = site();
		const boxes = [...c.querySelectorAll('h3')].map((h) => h.textContent?.trim());
		expect(boxes).toContain('Key skills:');
		expect(boxes).toContain('Contact for:');
		const card = [...c.querySelectorAll('article')].find((a) =>
			a.querySelector(':scope > h2')?.textContent?.includes('Highlights')
		);
		expect(card?.textContent).toContain('Shipped things');
		expect(card?.textContent).not.toContain('Consulting');
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
		expect(c.textContent).toContain('Get in Touch');
		expect(c.querySelector('a[href^="mailto:"]')).toBeNull();
		expect(c.querySelector('a[href^="tel:"]')).toBeNull();
	});
});
