/**
 * Portfolio themes: the `portfolio` kind of `presentation_templates`.
 *
 * A theme dresses the public profile site the way a document template dresses
 * a printed CV, and it is stored the same way: everything specific lives in
 * the row's `config` jsonb and its asset rows, so the repo ships a generic
 * renderer and no branding.
 *
 * Where it diverges from a document template is the part a print sheet has no
 * use for: section order, a light/dark choice, and the metadata a URL needs
 * when someone shares it. If those grow until they swamp what the two kinds
 * share, that is the signal to split the table after all — see the schema
 * comment on `presentation_templates`.
 */

import type { TemplateFont } from './presentation-templates';

/**
 * Sections a portfolio can show, in the order a fresh theme shows them.
 *
 * The ones that map onto profile tables render from live data. The narrative
 * ones have no column anywhere yet and render only once the profile has
 * something to put in them, so a theme may list a section the site then omits.
 */
export const PORTFOLIO_SECTIONS = [
	'header',
	'summary',
	'highlights',
	'work',
	'projects',
	'sideProjects',
	'skills',
	'education',
	'certificates',
	'languages',
	'references',
	'about'
] as const;
export type PortfolioSection = (typeof PORTFOLIO_SECTIONS)[number];

export function isPortfolioSection(value: string): value is PortfolioSection {
	return PORTFOLIO_SECTIONS.includes(value as PortfolioSection);
}

/** Asset slots a portfolio theme reads. Stored as `presentation_template_assets.key`. */
export interface PortfolioThemeAssets {
	/** Site logo, shown in the header. */
	logo?: string;
	/** Wide hero image behind the header. */
	hero?: string;
	/** Social preview image for shared links. */
	ogImage?: string;
	/** Site favicon. */
	favicon?: string;
	/** Portrait beside the About me. Showcase only; absent falls back to the profile photo. */
	photo?: string;
}

/**
 * Page structures a theme can pick. The layout is code; the theme only picks
 * one and fills in its values, so no theme carries markup of its own (a public
 * page rendering database content as HTML is the sink `svelte/no-at-html-tags`
 * exists to keep reviewed).
 *
 * - `basic`: one column of sections, the renderer every theme had first.
 * - `showcase`: a full-height header, an About me with the photo beside it,
 *   a band of quotes, the career as cards and a dark footer, with a light and
 *   dark palette and a visitor-facing switch between them.
 */
export const PORTFOLIO_LAYOUTS = ['basic', 'showcase'] as const;
export type PortfolioLayout = (typeof PORTFOLIO_LAYOUTS)[number];

export function isPortfolioLayout(value: string): value is PortfolioLayout {
	return PORTFOLIO_LAYOUTS.includes(value as PortfolioLayout);
}

/** The layout a theme renders with. Absent, or a value this build does not know, is `basic`. */
export function themeLayout(config: PortfolioThemeConfig): PortfolioLayout {
	return config.layout && isPortfolioLayout(config.layout) ? config.layout : 'basic';
}

/**
 * Colour roles the showcase layout paints with, named for what they do rather
 * than what colour they are, so a theme can be any colour at all.
 */
export const PALETTE_ROLES = [
	'text',
	'textOnDark',
	'highlight',
	'shade',
	'line',
	'surface',
	'surfaceRaised',
	'bright',
	'brightHover',
	'darkBand',
	'footer'
] as const;
export type PaletteRole = (typeof PALETTE_ROLES)[number];
export type PortfolioPalette = Partial<Record<PaletteRole, string>>;
export type PaletteScheme = 'light' | 'dark';

export const PALETTE_ROLE_LABELS: Record<PaletteRole, string> = {
	text: 'Text',
	textOnDark: 'Text on dark bands',
	highlight: 'Highlighted text',
	shade: 'Page background',
	line: 'Rules and borders',
	surface: 'Header background',
	surfaceRaised: 'Cards',
	bright: 'Buttons and headings',
	brightHover: 'Button hover, card borders',
	darkBand: 'Quotes band',
	footer: 'Footer'
};

/**
 * The showcase's own colours, used for any role a theme leaves unset. Neutral
 * on purpose: an applicant's colours are their theme's data, not this repo's.
 */
export const DEFAULT_PALETTE: Record<PaletteScheme, Record<PaletteRole, string>> = {
	light: {
		text: '#1f2937',
		textOnDark: '#f9fafb',
		highlight: '#4338ca',
		shade: '#e5e7eb',
		line: '#d1d5db',
		surface: '#f3f4f6',
		surfaceRaised: '#f9fafb',
		bright: '#4f46e5',
		brightHover: '#6366f1',
		darkBand: '#3730a3',
		footer: '#1e1b4b'
	},
	dark: {
		text: '#e5e7eb',
		textOnDark: '#e5e7eb',
		highlight: '#f3f4f6',
		shade: '#111827',
		line: '#374151',
		surface: '#0b1120',
		surfaceRaised: '#1f2937',
		bright: '#6366f1',
		brightHover: '#818cf8',
		darkBand: '#0f0d2e',
		footer: '#05040f'
	}
};

/**
 * One scheme's palette with every role filled: the theme's own value, else
 * its accent for the two roles an accent means, else the layout default.
 */
export function resolvePalette(
	config: PortfolioThemeConfig,
	scheme: PaletteScheme
): Record<PaletteRole, string> {
	const own = config.palette?.[scheme] ?? {};
	const accented: PortfolioPalette = config.accent
		? { bright: config.accent, highlight: config.accent }
		: {};
	const resolved = { ...DEFAULT_PALETTE[scheme] };
	for (const role of PALETTE_ROLES) {
		const value = own[role] ?? accented[role];
		if (value) resolved[role] = value;
	}
	return resolved;
}

/**
 * Both palettes as CSS custom properties, `--pf-light-text` and so on.
 *
 * Written as an inline style on the layout's root. An inline style cannot hold
 * a media query, so both schemes go in and the layout's stylesheet picks one
 * set onto the unprefixed names (`--pf-text`) by scheme, which is what lets
 * "follow the visitor's system setting" work before any script has run.
 */
export function paletteStyle(config: PortfolioThemeConfig): string {
	const parts: string[] = [];
	for (const scheme of ['light', 'dark'] as const) {
		const palette = resolvePalette(config, scheme);
		for (const role of PALETTE_ROLES)
			parts.push(`--pf-${scheme}-${cssName(role)}: ${palette[role]}`);
	}
	return parts.join('; ');
}

/** `surfaceRaised` -> `surface-raised`. */
export function cssName(role: PaletteRole): string {
	return role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

export interface PortfolioThemeConfig {
	/** Page structure. Absent means `basic`, so a theme from before layouts renders as it did. */
	layout?: PortfolioLayout;
	/** Accent colour (links, rules, section markers). */
	accent?: string;
	fonts?: { heading?: TemplateFont; body?: TemplateFont };
	assets?: PortfolioThemeAssets;
	/**
	 * Which sections appear and in what order. Absent means every section in
	 * `PORTFOLIO_SECTIONS` order; a section the profile cannot fill is skipped
	 * at render time either way.
	 */
	sections?: PortfolioSection[];
	/** Colour scheme the site renders in. Absent follows the visitor's system setting. */
	colorScheme?: 'light' | 'dark';
	/** File ref for the switcher thumbnail. */
	thumbnail?: string;
	/** Showcase colours per scheme. A role left out takes the layout's default. */
	palette?: Partial<Record<PaletteScheme, PortfolioPalette>>;
	/** Let visitors switch between light and dark. Showcase only. */
	schemeSwitcher?: boolean;
	/** Fade sections in on scroll. Showcase only. */
	animations?: boolean;
	/**
	 * Paint the logo in the palette's `bright` colour, using its shape as a
	 * mask, so a one-colour logo follows the scheme. Showcase only.
	 */
	logoTint?: boolean;
	/** Plain text above the contact details, once a visitor opens them. Showcase only. */
	contactIntro?: string;
	/** A line of plain text in the footer, such as a credit for the logo. Showcase only. */
	footerNote?: string;
	/** Where `footerNote` links to; an http(s) URL or nothing. Showcase only. */
	footerNoteUrl?: string;
	/** A heading per section in place of the layout's own. Plain text; showcase only. */
	titles?: Partial<Record<PortfolioSection, string>>;
}

export interface PortfolioTheme {
	id: number;
	name: string;
	slug: string;
	config: PortfolioThemeConfig;
}

/**
 * Every section, in the order the showcase shows them by default: the
 * introduction (header, about, quotes) first and the career after it, which is
 * how the site it was ported from reads.
 */
export const SHOWCASE_SECTIONS: readonly PortfolioSection[] = [
	'header',
	'about',
	'references',
	'summary',
	'highlights',
	'skills',
	'work',
	'projects',
	'education',
	'sideProjects',
	'certificates',
	'languages'
];

/** Sections this theme shows, in order, defaulting to all of them in its layout's order. */
export function themeSections(config: PortfolioThemeConfig): PortfolioSection[] {
	const chosen = config.sections?.filter(isPortfolioSection);
	if (chosen?.length) return chosen;
	return themeLayout(config) === 'showcase' ? [...SHOWCASE_SECTIONS] : [...PORTFOLIO_SECTIONS];
}

/** The default section order for a layout, which the editor stores as "absent". */
export function defaultSections(layout: PortfolioLayout): readonly PortfolioSection[] {
	return layout === 'showcase' ? SHOWCASE_SECTIONS : PORTFOLIO_SECTIONS;
}
