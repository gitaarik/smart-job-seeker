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
}

export interface PortfolioThemeConfig {
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
}

export interface PortfolioTheme {
	id: number;
	name: string;
	slug: string;
	config: PortfolioThemeConfig;
}

/** Sections this theme shows, in order, defaulting to all of them. */
export function themeSections(config: PortfolioThemeConfig): PortfolioSection[] {
	const chosen = config.sections?.filter(isPortfolioSection);
	return chosen?.length ? chosen : [...PORTFOLIO_SECTIONS];
}
