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
 * person before the public URL is ever set.
 */

import { error } from '@sveltejs/kit';
import { getProfileByIdentifier } from '$lib/server/profile/default';
import { checkProfileAccess, getVersionIdBySlug } from '$lib/server/profile/access-control';
import { incrementTokenVisit } from '$lib/server/auth/token-validation';
import { getPortfolioThemeById, getPortfolioTheme } from '$lib/server/profile/portfolio-themes';
import { isKnownLocale } from '$lib/resume-translations';
import { applyTranslations, loadTranslator } from '$lib/server/profile/translations';
import {
	applyFieldVariants,
	loadFieldVariants,
	withoutFieldVariants
} from '$lib/server/profile/field-variants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals, getClientAddress }) => {
	const { slug } = params;
	const token = url.searchParams.get('t');

	const profile = await getProfileByIdentifier(slug);
	if (!profile) {
		throw error(404, { message: `Profile not found: ${slug}` });
	}

	const accessResult = await checkProfileAccess({
		profile,
		token,
		userId: locals.user?.id,
		clientIp: getClientAddress(),
		routeType: 'portfolio'
	});

	if (!accessResult.allowed) {
		throw error(accessResult.statusCode, { message: accessResult.message });
	}

	if (accessResult.accessType === 'token' && accessResult.tokenId) {
		await incrementTokenVisit(accessResult.tokenId, getClientAddress());
	}

	// Which version feeds the site. An owner may preview any of them with
	// `?version=`; everyone else gets the published one, which access control
	// has already read off the profile.
	let versionId = accessResult.versionId;
	if (!versionId && accessResult.accessType === 'owner') {
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
	const theme =
		themeSlug && accessResult.accessType === 'owner'
			? await getPortfolioTheme(profile.id, themeSlug)
			: profile.public_portfolio_theme_id
				? await getPortfolioThemeById(profile.id, profile.public_portfolio_theme_id)
				: null;

	// Published means BOTH pointers, so a site missing either is not published
	// — not a blank page, and not an undressed one. The half state is reachable
	// (a theme deleted out from under a published site nulls its own pointer by
	// foreign key), which is exactly why this is checked here rather than
	// trusted from the access-control column alone.
	if (!theme || !versionId) {
		throw error(404, {
			message:
				accessResult.accessType === 'owner'
					? 'This portfolio is not published yet. Publish a theme from Profile → Portfolio Site.'
					: 'Not found'
		});
	}

	// The same three overlays the documents apply, in the same order — see
	// server/profile/field-variants.ts. No template overrides: those are keyed
	// to a document template, and this route resolves a theme instead.
	const langParam = url.searchParams.get('lang');
	const translator = await loadTranslator(profile.id, isKnownLocale(langParam) ? langParam : null);
	applyTranslations(profile, translator);
	applyFieldVariants(profile, await loadFieldVariants(profile.id, versionId, translator));

	return {
		// Stripped of the wording library before serialising: the variants are
		// in the tree for the server's benefit, and a public page must not
		// carry the alternatives it did not use.
		profile: {
			...withoutFieldVariants(profile),
			profile_versions: profile.profile_versions
		},
		theme,
		locale: translator.locale,
		versionId: versionId ?? null,
		accessType: accessResult.accessType
	};
};
