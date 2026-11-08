/**
 * Banner templates: the `banner` kind of `presentation_templates`.
 *
 * A banner is a layout, not a file: a logo, a name, a title or headline and a
 * tagline, in a portfolio theme's colours and fonts, drawn by the headless
 * browser that prints CVs at the size of each platform it is for. A new
 * version of a banner is a change of words or theme, drawn everywhere at once;
 * each drawing lands in the media library as a new version of the last one, so
 * the platforms still showing the old drawing can be listed.
 *
 * Client-safe: the config's shape and its defaults. The drawing is in
 * server/media/banners.ts.
 */

export const BANNER_ALIGNMENTS = ['left', 'center', 'right'] as const;
export type BannerAlignment = (typeof BANNER_ALIGNMENTS)[number];

export const BANNER_LINES = ['title', 'headline'] as const;
export type BannerLine = (typeof BANNER_LINES)[number];

export interface BannerTemplateConfig {
	/** The portfolio theme whose palette and fonts it uses; none means the showcase's own. */
	themeId?: number | null;
	/** Which of the theme's palettes. */
	scheme?: 'light' | 'dark';
	/** The resume version whose wording of the title it takes; none means the profile's own. */
	versionId?: number | null;
	/** The line under the name. */
	line?: BannerLine;
	/** Words in place of the profile's, when the banner should say something else. */
	name?: string | null;
	title?: string | null;
	/** A last line; none means the profile's core stack. */
	tagline?: string | null;
	/**
	 * Where the words sit. Right is the default because LinkedIn and X put the
	 * profile photo over the lower left of the banner.
	 */
	align?: BannerAlignment;
	showLogo?: boolean;
	/** The presets it is drawn at. */
	presetIds?: number[];
}

export function bannerAlignment(value: unknown): BannerAlignment {
	return (BANNER_ALIGNMENTS as readonly unknown[]).includes(value)
		? (value as BannerAlignment)
		: 'right';
}

export function bannerLine(value: unknown): BannerLine {
	return value === 'headline' ? 'headline' : 'title';
}
