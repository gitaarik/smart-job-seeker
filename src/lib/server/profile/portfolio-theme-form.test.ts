import { describe, expect, test } from 'vitest';
import { DEFAULT_PALETTE, type PortfolioThemeConfig } from '$lib/portfolio-themes';
import { applyShowcaseFields } from './portfolio-theme-form';

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [k, v] of Object.entries(fields)) data.set(k, v);
	return data;
}

describe('applyShowcaseFields', () => {
	test('stores only the palette roles that differ from what the layout paints anyway', () => {
		const next: PortfolioThemeConfig = { layout: 'showcase' };
		const problem = applyShowcaseFields(
			next,
			form({
				'palette.light.text': DEFAULT_PALETTE.light.text,
				'palette.light.footer': '#ABCDEF',
				'palette.dark.text': DEFAULT_PALETTE.dark.text
			})
		);
		expect(problem).toBeNull();
		expect(next.palette).toEqual({ light: { footer: '#abcdef' } });
	});

	test('a colour equal to the accent is not stored for the roles the accent sets', () => {
		const next: PortfolioThemeConfig = { accent: '#2c708b' };
		applyShowcaseFields(next, form({ 'palette.light.bright': '#2c708b' }));
		expect(next.palette).toBeUndefined();
	});

	test('refuses a colour that is not hex', () => {
		expect(applyShowcaseFields({}, form({ 'palette.dark.text': 'red' }))).toMatch(/hex/);
	});

	test('refuses a footer link that is not a web link', () => {
		expect(applyShowcaseFields({}, form({ footerNoteUrl: 'javascript:alert(1)' }))).toMatch(/http/);
		const next: PortfolioThemeConfig = {};
		expect(applyShowcaseFields(next, form({ footerNoteUrl: 'https://example.com/x' }))).toBeNull();
		expect(next.footerNoteUrl).toBe('https://example.com/x');
	});

	test('switches and texts are written when set and dropped when cleared', () => {
		const next: PortfolioThemeConfig = {
			animations: true,
			contactIntro: 'old',
			titles: { work: 'Old' }
		};
		applyShowcaseFields(
			next,
			form({ schemeSwitcher: 'on', 'title.references': ' What Clients Say ', contactIntro: '' })
		);
		expect(next.schemeSwitcher).toBe(true);
		expect(next.animations).toBeUndefined();
		expect(next.contactIntro).toBeUndefined();
		expect(next.titles).toEqual({ references: 'What Clients Say' });
	});
});
