import { describe, expect, test } from 'vitest';
import {
	DEFAULT_PALETTE,
	HOME_SECTIONS,
	PALETTE_ROLES,
	PORTFOLIO_SECTIONS,
	SHOWCASE_SECTIONS,
	hasPrivateCv,
	pageSections,
	paletteStyle,
	resolvePalette,
	themeLayout,
	themeSections,
	type PortfolioThemeConfig
} from './portfolio-themes';

describe('themeLayout', () => {
	test('a theme from before layouts renders basic', () => {
		expect(themeLayout({})).toBe('basic');
	});

	test('a layout this build does not know renders basic rather than nothing', () => {
		expect(themeLayout({ layout: 'magazine' } as unknown as PortfolioThemeConfig)).toBe('basic');
	});

	test('a theme with unknown fields still loads', () => {
		const config = { layout: 'showcase', sparkles: true } as unknown as PortfolioThemeConfig;
		expect(themeLayout(config)).toBe('showcase');
		expect(themeSections(config)).toEqual([...SHOWCASE_SECTIONS]);
	});
});

describe('themeSections', () => {
	test('defaults to the layout order', () => {
		expect(themeSections({})).toEqual([...PORTFOLIO_SECTIONS]);
		expect(themeSections({ layout: 'showcase' })).toEqual([...SHOWCASE_SECTIONS]);
	});

	test('the showcase default holds every section once', () => {
		expect([...SHOWCASE_SECTIONS].sort()).toEqual([...PORTFOLIO_SECTIONS].sort());
	});

	test('a chosen order wins over either default', () => {
		expect(themeSections({ layout: 'showcase', sections: ['work', 'header'] })).toEqual([
			'work',
			'header'
		]);
	});
});

describe('palette', () => {
	test('writes every role for both schemes as a custom property', () => {
		const style = paletteStyle({});
		for (const scheme of ['light', 'dark']) {
			expect(style).toContain(`--pf-${scheme}-text:`);
			expect(style).toContain(`--pf-${scheme}-surface-raised:`);
			expect(style).toContain(`--pf-${scheme}-dark-band:`);
		}
		expect(style.split(';')).toHaveLength(PALETTE_ROLES.length * 2);
	});

	test('a role the theme leaves out takes the default; one it sets wins', () => {
		const light = resolvePalette({ palette: { light: { text: '#123456' } } }, 'light');
		expect(light.text).toBe('#123456');
		expect(light.footer).toBe(DEFAULT_PALETTE.light.footer);
	});

	test('the accent paints the button and highlight roles unless the palette sets them', () => {
		expect(resolvePalette({ accent: '#ff8800' }, 'dark').bright).toBe('#ff8800');
		expect(
			resolvePalette({ accent: '#ff8800', palette: { dark: { bright: '#000000' } } }, 'dark').bright
		).toBe('#000000');
	});
});

describe('the private CV page', () => {
	const split: PortfolioThemeConfig = { layout: 'showcase', privateCv: true };

	test('only a showcase that asks for it has one', () => {
		expect(hasPrivateCv(split)).toBe(true);
		expect(hasPrivateCv({ layout: 'showcase' })).toBe(false);
		// The basic layout has no second page to put the career on.
		expect(hasPrivateCv({ privateCv: true })).toBe(false);
	});

	test('the public page keeps the introduction, Selected work and the quotes', () => {
		expect(pageSections(split, 'home')).toEqual(['header', 'about', 'featured', 'references']);
	});

	test('the CV page takes the rest, in the theme’s own order', () => {
		const sections: PortfolioThemeConfig['sections'] = ['header', 'work', 'about', 'skills'];
		expect(pageSections({ ...split, sections }, 'cv')).toEqual(['work', 'skills']);
		expect(pageSections({ ...split, sections }, 'home')).toEqual(['header', 'about']);
	});

	test('every section lands on exactly one of the two pages', () => {
		const home = pageSections(split, 'home');
		const cv = pageSections(split, 'cv');
		expect([...home, ...cv].sort()).toEqual([...SHOWCASE_SECTIONS].sort());
		expect(home.every((s) => HOME_SECTIONS.has(s))).toBe(true);
	});

	test('one page shows every section', () => {
		expect(pageSections(split, 'site')).toEqual([...SHOWCASE_SECTIONS]);
	});
});
