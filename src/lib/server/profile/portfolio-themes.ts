/**
 * Server-side loading of per-profile portfolio themes: the `portfolio` kind of
 * `presentation_templates`.
 *
 * The mirror of `resume-templates.ts`. Both pin their own `kind` and neither
 * takes it as a parameter, which is what keeps a theme out of the CV template
 * switcher and a CV template off the public site.
 */

import type { PortfolioTheme, PortfolioThemeConfig } from '$lib/portfolio-themes';
import {
	loadTemplateOfKind,
	loadTemplateOfKindById,
	loadTemplatesOfKind,
	isTemplateOwnedOfKind
} from './presentation-templates';

const KIND = 'portfolio' as const;

/** All published portfolio themes for a profile, in sort order. */
export async function getPortfolioThemesForProfile(profileId: number): Promise<PortfolioTheme[]> {
	return loadTemplatesOfKind<PortfolioThemeConfig>(profileId, KIND);
}

/** A single published portfolio theme by slug, or null. */
export async function getPortfolioTheme(
	profileId: number,
	slug: string
): Promise<PortfolioTheme | null> {
	return loadTemplateOfKind<PortfolioThemeConfig>(profileId, KIND, slug);
}

/** A single published portfolio theme by id, or null — what the publish pointer resolves through. */
export async function getPortfolioThemeById(
	profileId: number,
	themeId: number
): Promise<PortfolioTheme | null> {
	return loadTemplateOfKindById<PortfolioThemeConfig>(profileId, KIND, themeId);
}

/** Whether a portfolio theme id belongs to this profile. */
export async function isPortfolioThemeOwned(profileId: number, themeId: number): Promise<boolean> {
	return isTemplateOwnedOfKind(profileId, KIND, themeId);
}
