/**
 * The showcase layout's fields on the Portfolio Site editor's design form.
 *
 * Out of the route so it can be tested: a `+page.server.ts` may export only
 * what SvelteKit knows (`load`, `actions` and the page options).
 */

import {
	PALETTE_ROLES,
	PORTFOLIO_SECTIONS,
	resolvePalette,
	type PortfolioPalette,
	type PortfolioThemeConfig
} from '$lib/portfolio-themes';

/** A hex colour, the only form a palette's CSS variable can take. */
const HEX = /^#[0-9a-f]{6}$/i;

/** Longest plain text a showcase field takes, by field. */
const TEXT_LIMITS = { contactIntro: 500, footerNote: 200, title: 80 } as const;

/**
 * Read the showcase's fields from the design form into `next`, or say what is
 * wrong with them.
 *
 * A palette colour is stored only where it differs from what the layout would
 * paint anyway (its default, or the accent for the two roles an accent sets):
 * every colour input always submits, and storing them all would pin today's
 * defaults into the row the way a stored section list pins today's sections.
 */
export function applyShowcaseFields(next: PortfolioThemeConfig, form: FormData): string | null {
	const palette: NonNullable<PortfolioThemeConfig['palette']> = {};
	for (const scheme of ['light', 'dark'] as const) {
		const fallback = resolvePalette({ accent: next.accent }, scheme);
		const own: PortfolioPalette = {};
		for (const role of PALETTE_ROLES) {
			const value = String(form.get(`palette.${scheme}.${role}`) ?? '').trim();
			if (!value) continue;
			if (!HEX.test(value)) return 'Palette colours must be hex colours like #ff8800.';
			if (value.toLowerCase() !== fallback[role].toLowerCase()) own[role] = value.toLowerCase();
		}
		if (Object.keys(own).length > 0) palette[scheme] = own;
	}
	if (Object.keys(palette).length > 0) next.palette = palette;
	else delete next.palette;

	for (const flag of ['schemeSwitcher', 'animations', 'logoTint'] as const) {
		if (form.get(flag)) next[flag] = true;
		else delete next[flag];
	}

	for (const field of ['contactIntro', 'footerNote'] as const) {
		const value = String(form.get(field) ?? '').trim();
		if (value.length > TEXT_LIMITS[field]) {
			return `That text is too long (${TEXT_LIMITS[field]} characters at most).`;
		}
		if (value) next[field] = value;
		else delete next[field];
	}

	// Rendered as an href on a public page, so a web link or nothing: anything
	// else (`javascript:` above all) would run on this app's origin.
	const footerNoteUrl = String(form.get('footerNoteUrl') ?? '').trim();
	if (footerNoteUrl && !/^https?:\/\/\S+$/i.test(footerNoteUrl)) {
		return 'The footer link must start with http:// or https://.';
	}
	if (footerNoteUrl) next.footerNoteUrl = footerNoteUrl;
	else delete next.footerNoteUrl;

	const titles: NonNullable<PortfolioThemeConfig['titles']> = {};
	for (const section of PORTFOLIO_SECTIONS) {
		const value = String(form.get(`title.${section}`) ?? '').trim();
		if (value.length > TEXT_LIMITS.title) {
			return `Section headings take ${TEXT_LIMITS.title} characters at most.`;
		}
		if (value) titles[section] = value;
	}
	if (Object.keys(titles).length > 0) next.titles = titles;
	else delete next.titles;

	return null;
}
