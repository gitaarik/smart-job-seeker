/**
 * What a portfolio page tells link previews and search engines about itself:
 * the canonical address, absolute image URLs and a schema.org Person.
 *
 * Everything here is absolute, because the readers are not browsers on this
 * page. LinkedIn and Slack drop a relative og:image, and a canonical link only
 * means something with a host in it.
 *
 * The canonical address is the theme's `siteUrl` when it has one, since the
 * same page is served under a custom domain as well as under /p/<slug>/portfolio
 * (rikwanders.tech, planning/PORTFOLIO-SHOWCASE-LAYOUT.md in sjs-ops). Without
 * it, the app's own public address of the page, never the request's: that
 * carries `?t=` share tokens and owner previews, and behind the proxy it reads
 * http.
 */

import { assetUrl } from '$lib/presentation-templates';
import { getProfilePhotoUrl } from '$lib/utils/profile-photo-url';
import type { PortfolioThemeConfig } from '$lib/portfolio-themes';

/** The addresses a page needs for its head; worked out on the server, which knows the app's own. */
export interface PortfolioSeoUrls {
	/** The page's one address, for the canonical link and og:url. */
	canonicalUrl: string;
	/** The app's public origin, which resolves /assets/… paths. */
	appUrl: string;
}

const WEB_URL = /^https?:\/\/\S+$/i;

/** A web address a theme may name as its own site, or nothing else. */
export function isSiteUrl(value: unknown): value is string {
	return typeof value === 'string' && WEB_URL.test(value.trim());
}

export function portfolioSeoUrls(
	config: PortfolioThemeConfig,
	appUrl: string,
	slug: string
): PortfolioSeoUrls {
	const base = appUrl.replace(/\/+$/, '');
	return {
		canonicalUrl: isSiteUrl(config.siteUrl)
			? config.siteUrl.trim()
			: `${base}/p/${encodeURIComponent(slug)}/portfolio`,
		appUrl: base
	};
}

/** A path made absolute against the app; an absolute URL passes through. */
export function absoluteUrl(href: string | null | undefined, appUrl: string): string | null {
	if (!href) return null;
	try {
		return new URL(href, `${appUrl}/`).href;
	} catch {
		return null;
	}
}

const web = (url: unknown): string | null =>
	typeof url === 'string' && WEB_URL.test(url.trim()) ? url.trim() : null;

/**
 * The schema.org Person behind the page, as the body of a JSON-LD script.
 *
 * Contact details stay out: a showcase keeps them behind its Turnstile gate,
 * and this would print them for any crawler. `personal_website` stays out too,
 * for the reason the showcase footer gives: this is the site.
 *
 * `<` is escaped so profile text cannot close the script element it sits in.
 */
export function personJsonLd(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	profile: any,
	config: PortfolioThemeConfig,
	urls: PortfolioSeoUrls
): string {
	const sameAs = [
		profile.linkedin_profile,
		profile.github_profile,
		profile.pypi_profile,
		profile.npm_profile,
		profile.stackoverflow_profile
	]
		.map(web)
		.filter((url): url is string => !!url);
	const image = absoluteUrl(
		assetUrl(config.assets?.photo) ?? getProfilePhotoUrl(profile),
		urls.appUrl
	);
	const person = {
		'@context': 'https://schema.org',
		'@type': 'Person',
		name: profile.name || undefined,
		jobTitle: profile.title || undefined,
		description: profile.headline || undefined,
		url: urls.canonicalUrl,
		image: image ?? undefined,
		sameAs: sameAs.length ? sameAs : undefined
	};
	return JSON.stringify(person).replace(/</g, '\\u003c');
}
