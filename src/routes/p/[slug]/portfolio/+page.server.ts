/**
 * The public portfolio site.
 *
 * Enabled 2026-09-11, having thrown 404 since the dashboard redesign. It is
 * published the same way the resume and CV routes are: a column on `profiles`
 * naming the version to show, plus — unique to this route — one naming the
 * theme to show it with. Both null is the unpublished state, so there is no
 * enable flag that can disagree with whether there is anything to serve.
 *
 * Access goes through the same `checkProfileAccess` as the documents, which
 * means a `?t=` token works here too and a portfolio can be shown to one
 * person before the public URL is ever set. So does the key a portfolio share
 * link leaves in the visitor's browser (server/profile/portfolio-key.ts).
 *
 * A theme can keep the career on a private page of its own (`privateCv`, the
 * `cv` route beside this one). This page is then the public half: the
 * introduction and the featured projects, its data cut down to match
 * (server/profile/portfolio-pages.ts), with a way to the CV page for a
 * visitor who holds the key.
 */

import { error } from '@sveltejs/kit';
import { getProfileByIdentifier } from '$lib/server/profile/default';
import {
	checkProfileAccess,
	getVersionIdBySlug,
	type AccessControlResult
} from '$lib/server/profile/access-control';
import { incrementTokenVisit, touchTokenVisit } from '$lib/server/auth/token-validation';
import {
	getPortfolioThemeById,
	getPortfolioTheme,
	getPortfolioThemesForProfile
} from '$lib/server/profile/portfolio-themes';
import { isKnownLocale } from '$lib/resume-translations';
import { applyTranslations, loadTranslator } from '$lib/server/profile/translations';
import { applyFieldVariants, loadFieldVariants } from '$lib/server/profile/field-variants';
import { pageProfile } from '$lib/server/profile/page-profile';
import { applySkillWords, loadDocumentSkillWords } from '$lib/server/profile/skill-words';
import { gatesContact, withoutContact } from '$lib/server/profile/portfolio-contact';
import { portfolioBusiness } from '$lib/server/profile/portfolio-business';
import { givePortfolioKey, readPortfolioKey } from '$lib/server/profile/portfolio-key';
import { homePageProfile, portfolioHrefs } from '$lib/server/profile/portfolio-pages';
import { hasPrivateCv, type PortfolioPage } from '$lib/portfolio-themes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals, cookies, getClientAddress }) => {
	const { slug } = params;
	const token = url.searchParams.get('t');

	const profile = await getProfileByIdentifier(slug);
	if (!profile) {
		throw error(404, { message: `Profile not found: ${slug}` });
	}

	let accessResult: AccessControlResult = await checkProfileAccess({
		profile,
		token,
		userId: locals.user?.id,
		clientIp: getClientAddress(),
		routeType: 'portfolio'
	});
	const owner = accessResult.accessType === 'owner';

	// The key a portfolio link left in this browser, if it still opens the site.
	const key = owner ? null : await readPortfolioKey(cookies, url, profile.id);

	if (!accessResult.allowed) {
		// A token in the URL that does not check out stays an error. Without one,
		// a site that is not published yet is open to whoever holds its key, as
		// it is to whoever holds the link.
		if (token || !key) {
			throw error(accessResult.statusCode, { message: accessResult.message });
		}
		accessResult = {
			allowed: true,
			statusCode: 200,
			message: 'Key access granted',
			versionId: key.versionId,
			tokenId: key.tokenId,
			accessType: 'token'
		};
		await touchTokenVisit(key.tokenId, getClientAddress());
	} else if (accessResult.accessType === 'token' && accessResult.tokenId) {
		await incrementTokenVisit(accessResult.tokenId, getClientAddress());
		// A portfolio link in the URL leaves its key too, so the way to the
		// private CV page works for this visitor as it does after s/[token].
		if (token && accessResult.tokenFormat === 'portfolio') {
			givePortfolioKey(cookies, url, profile.id, token, accessResult.tokenExpiresAt);
		}
	}
	const holdsKey = owner || !!key || accessResult.tokenFormat === 'portfolio';

	// Which version feeds the site. An owner may preview any of them with
	// `?version=`; everyone else gets the published one, which access control
	// has already read off the profile.
	let versionId = accessResult.versionId;
	if (!versionId && owner) {
		const versionSlug = url.searchParams.get('version');
		versionId = versionSlug
			? ((await getVersionIdBySlug(profile.id, versionSlug)) ?? undefined)
			: (profile.public_portfolio_version_id ?? undefined);
	}

	// Which theme dresses it. `?theme=` is an owner-only preview by slug, for
	// trying a theme before publishing it; everyone else sees the published
	// one. Either way the loader pins kind=portfolio, so a CV template slug
	// resolves to nothing rather than rendering as a site.
	const themeSlug = url.searchParams.get('theme');
	let theme =
		themeSlug && owner
			? await getPortfolioTheme(profile.id, themeSlug)
			: profile.public_portfolio_theme_id
				? await getPortfolioThemeById(profile.id, profile.public_portfolio_theme_id)
				: null;
	// A link may show the site before it is published, as s/[token] always
	// could: with the profile's first theme then. See that route for why.
	if (!theme && accessResult.accessType === 'token') {
		theme = (await getPortfolioThemesForProfile(profile.id))[0] ?? null;
	}

	// Published means BOTH pointers, so a site missing either is not published
	// — not a blank page, and not an undressed one. The half state is reachable
	// (a theme deleted out from under a published site nulls its own pointer by
	// foreign key), which is exactly why this is checked here rather than
	// trusted from the access-control column alone.
	if (!theme || !versionId) {
		throw error(404, {
			message: owner
				? 'This portfolio is not published yet. Publish a theme from Profile → Portfolio Site.'
				: 'Not found'
		});
	}

	// The same three overlays the documents apply, in the same order — see
	// server/profile/field-variants.ts.
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

	// The whole site on this one page, or its public half.
	const page: PortfolioPage = hasPrivateCv(theme.config) ? 'home' : 'site';

	// Only what the page renders: the tree is serialised into it, and the rest
	// of it is private. See server/profile/page-profile.ts. The public half of
	// a site with a private CV page carries none of the career (see
	// server/profile/portfolio-pages.ts). A showcase keeps the contact details
	// out as well, behind its Turnstile gate; see
	// server/profile/portfolio-contact.ts.
	const shown = pageProfile(profile, versionId, translator.locale);
	const visible = page === 'home' ? homePageProfile(shown, versionId) : shown;
	const gated = gatesContact(theme) ? withoutContact(visible) : null;

	const hrefs =
		page === 'home' && holdsKey ? portfolioHrefs(profile.slug ?? slug, url, owner) : null;

	return {
		profile: gated?.profile ?? visible,
		contact: gated?.contact ?? null,
		// Private columns the theme chose to print in its footer; read off the
		// full row, since the page profile carries none of them.
		business: portfolioBusiness(profile, theme),
		accessToken: accessResult.accessType === 'token' ? token : null,
		theme,
		locale: translator.locale,
		versionId: versionId ?? null,
		accessType: accessResult.accessType,
		page,
		homeHref: hrefs?.home ?? null,
		cvHref: hrefs?.cv ?? null
	};
};
