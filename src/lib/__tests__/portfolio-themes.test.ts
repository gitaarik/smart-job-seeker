/**
 * Which sections a portfolio theme shows, and in what order.
 *
 * `themeSections` is the whole of the theme's say over the page: the renderer
 * walks what it returns. A theme that returns nothing usable has to fall back
 * to every section rather than to an empty site, because an empty site is what
 * a visitor would see.
 */

import { describe, expect, it } from 'vitest';
import {
	PORTFOLIO_SECTIONS,
	isPortfolioSection,
	themeSections,
	type PortfolioThemeConfig
} from '../portfolio-themes';

describe('themeSections', () => {
	it('shows every section in the declared order when the theme says nothing', () => {
		expect(themeSections({})).toEqual([...PORTFOLIO_SECTIONS]);
	});

	it('keeps the theme order rather than the declared one', () => {
		const config: PortfolioThemeConfig = { sections: ['skills', 'header', 'work'] };
		expect(themeSections(config)).toEqual(['skills', 'header', 'work']);
	});

	// A config is jsonb, so a section name can outlive the code that rendered
	// it: a theme saved before a section was renamed must not put an unknown
	// name in front of the renderer.
	it('drops section names it does not recognise', () => {
		const config = { sections: ['header', 'testimonials', 'skills'] } as PortfolioThemeConfig;
		expect(themeSections(config)).toEqual(['header', 'skills']);
	});

	it('falls back to every section when the list is empty or filters down to nothing', () => {
		expect(themeSections({ sections: [] })).toEqual([...PORTFOLIO_SECTIONS]);
		const allUnknown = { sections: ['testimonials', 'press'] } as unknown as PortfolioThemeConfig;
		expect(themeSections(allUnknown)).toEqual([...PORTFOLIO_SECTIONS]);
	});

	it('starts with the header, which is the only section with a fixed place', () => {
		expect(PORTFOLIO_SECTIONS[0]).toBe('header');
	});
});

describe('isPortfolioSection', () => {
	it('accepts every declared section', () => {
		for (const section of PORTFOLIO_SECTIONS) expect(isPortfolioSection(section)).toBe(true);
	});

	it('rejects anything else', () => {
		expect(isPortfolioSection('testimonials')).toBe(false);
		expect(isPortfolioSection('')).toBe(false);
		expect(isPortfolioSection('Header')).toBe(false);
	});
});
