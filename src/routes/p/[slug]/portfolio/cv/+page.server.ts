/**
 * The portfolio's private CV page: the whole career, for the people the
 * applicant sent a portfolio share link to.
 *
 * Only a theme with `privateCv` has this page (see $lib/portfolio-themes.ts);
 * the public page beside it then keeps to the introduction and the featured
 * projects. It opens for the owner and for a visitor holding the key a
 * portfolio link leaves behind (server/profile/portfolio-key.ts), never for
 * the public, and it asks search engines and caches to keep it to themselves.
 *
 * A visitor without the key is sent to the public page rather than shown an
 * error: a bookmark whose link has since been disabled lands somewhere useful,
 * and a visitor who never had a key learns nothing from where they land.
 */

import { error, redirect } from '@sveltejs/kit';
import { getProfileByIdentifier } from '$lib/server/profile/default';
import { getVersionIdBySlug } from '$lib/server/profile/access-control';
import {
	incrementTokenVisit,
	touchTokenVisit,
	validateToken
} from '$lib/server/auth/token-validation';
import {
	getPortfolioTheme,
	getPortfolioThemeById,
	getPortfolioThemesForProfile
} from '$lib/server/profile/portfolio-themes';
import { isKnownLocale } from '$lib/resume-translations';
import { applyTranslations, loadTranslator } from '$lib/server/profile/translations';
import { applyFieldVariants, loadFieldVariants } from '$lib/server/profile/field-variants';
import { pageProfile } from '$lib/server/profile/page-profile';
import { applySkillWords, loadDocumentSkillWords } from '$lib/server/profile/skill-words';
import { withoutContact } from '$lib/server/profile/portfolio-contact';
import { portfolioBusiness } from '$lib/server/profile/portfolio-business';
import { givePortfolioKey, readPortfolioKey } from '$lib/server/profile/portfolio-key';
import { portfolioHrefs } from '$lib/server/profile/portfolio-pages';
import { hasPrivateCv } from '$lib/portfolio-themes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({
	params,
	url,
	locals,
	cookies,
	setHeaders,
	getClientAddress
}) => {
	// Not for search engines, and not for a shared cache to hand to the next
	// visitor. The page's own <meta name="robots"> says the first again for
	// crawlers that read only the HTML.
	setHeaders({ 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'private, no-store' });

	const profile = await getProfileByIdentifier(params.slug);
	if (!profile) throw error(404, { message: 'Not found' });

	const owner = !!locals.user?.id && profile.user_id === locals.user.id;
	const hrefs = portfolioHrefs(profile.slug ?? params.slug, url, owner);
	const published = !!profile.public_portfolio_version_id && !!profile.public_portfolio_theme_id;

	// A portfolio link can name this page directly (`?t=`): it is counted as an
	// opening, leaves its key, and comes back without the token, so the token
	// stays out of the address bar, the history and any link copied from it.
	const token = url.searchParams.get('t');
	if (token && !owner) {
		const link = await validateToken(token, profile.id);
		if (link.valid && link.format === 'portfolio' && link.tokenId) {
			await incrementTokenVisit(link.tokenId, getClientAddress());
			givePortfolioKey(cookies, url, profile.id, token, link.expiresAt);
			const clean = new URL(url);
			clean.searchParams.delete('t');
			redirect(303, `${clean.pathname}${clean.search}`);
		}
	}

	const key = owner ? null : await readPortfolioKey(cookies, url, profile.id);
	if (!owner && !key) {
		if (published) redirect(303, hrefs.home);
		throw error(404, { message: 'Not found' });
	}
	// Seen again, not counted again: the opening was counted when the link was.
	if (key) await touchTokenVisit(key.tokenId, getClientAddress());

	// The version the link was made for; the owner previews like on the public
	// page, `?version=` or the published one.
	let versionId: number | undefined = key?.versionId;
	if (owner) {
		const versionSlug = url.searchParams.get('version');
		versionId = versionSlug
			? ((await getVersionIdBySlug(profile.id, versionSlug)) ?? undefined)
			: (profile.public_portfolio_version_id ?? undefined);
	}

	// The theme as the public page picks it, including its fallback for a
	// link to a site not yet published.
	const themeSlug = url.searchParams.get('theme');
	let theme =
		themeSlug && owner
			? await getPortfolioTheme(profile.id, themeSlug)
			: profile.public_portfolio_theme_id
				? await getPortfolioThemeById(profile.id, profile.public_portfolio_theme_id)
				: null;
	if (!theme && key) theme = (await getPortfolioThemesForProfile(profile.id))[0] ?? null;

	if (!theme || !versionId) {
		throw error(404, {
			message: owner
				? 'This portfolio is not published yet. Publish a theme from Profile → Portfolio Site.'
				: 'Not found'
		});
	}

	// A site without a private CV page prints its career on its one page.
	if (!hasPrivateCv(theme.config)) redirect(303, hrefs.home);

	// The overlays every page applies, in the same order (see
	// server/profile/field-variants.ts).
	const langParam = url.searchParams.get('lang');
	const translator = await loadTranslator(profile.id, isKnownLocale(langParam) ? langParam : null);
	applyTranslations(profile, translator);
	locals.documentLocale = translator.locale;
	applyFieldVariants(profile, await loadFieldVariants(profile.id, versionId, translator));
	applySkillWords(
		profile,
		await loadDocumentSkillWords(profile, versionId),
		'portfolio',
		versionId
	);

	// The page's tree, its contact details behind the showcase's gate like on
	// the public page. A private CV page is always a showcase (hasPrivateCv).
	const gated = withoutContact(pageProfile(profile, versionId, translator.locale));

	return {
		profile: gated.profile,
		contact: gated.contact,
		business: portfolioBusiness(profile, theme),
		theme,
		locale: translator.locale,
		versionId,
		page: 'cv' as const,
		homeHref: hrefs.home,
		cvHref: hrefs.cv
	};
};
