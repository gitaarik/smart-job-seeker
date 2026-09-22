import { BASE_LOCALE, isKnownLocale } from '$lib/resume-translations';

/**
 * Fill in what app.html cannot know until a page has rendered: the theme, and
 * the language of a public document (`/p/[slug]/resume?lang=nl`), which its
 * load reports through `locals.documentLocale`.
 *
 * Both are plain replacements on the root tag, so they depend on app.html
 * spelling out `<html lang="en"` and `class="theme-light"`. The test holds
 * app.html to that, because a replacement that finds nothing fails silently:
 * every Dutch CV would be English again with nothing red anywhere.
 */
export function shapeHtmlShell(html: string, theme: string, locale: string | undefined): string {
	const lang = isKnownLocale(locale) ? locale : BASE_LOCALE;
	return html
		.replace('class="theme-light"', `class="theme-${theme}"`)
		.replace('<html lang="en"', `<html lang="${lang}"`);
}
