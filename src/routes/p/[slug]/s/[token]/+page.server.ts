import { error, redirect } from '@sveltejs/kit';
import { getProfileByIdentifier } from '$lib/server/profile/default';
import { incrementTokenVisit } from '$lib/server/auth/token-validation';
import { hashToken } from '$lib/server/auth/token-generator';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { profile_tokens, profile_versions } from '$lib/server/db/schema';
import { DEFAULT_FORMAT, DEFAULT_VIEW_MODE } from '$lib/profile-tokens';
import {
	getPortfolioThemeById,
	getPortfolioThemesForProfile
} from '$lib/server/profile/portfolio-themes';
import { BASE_LOCALE, isKnownLocale } from '$lib/resume-translations';
import { applyTranslations, loadTranslator } from '$lib/server/profile/translations';
import {
	applyFieldVariants,
	loadFieldVariants,
	withoutFieldVariants
} from '$lib/server/profile/field-variants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, getClientAddress }) => {
	const { slug, token: tokenString } = params;

	// Get profile by slug
	const profile = await getProfileByIdentifier(slug);

	if (!profile) {
		throw error(404, {
			message: `Profile not found`
		});
	}

	// Find the token
	const tokenHash = hashToken(tokenString);
	const token = await db.query.profile_tokens.findFirst({
		where: eq(profile_tokens.token_hash, tokenHash)
	});

	if (!token) {
		throw error(404, {
			message: 'This link is not valid'
		});
	}

	if (token.status !== 'published') {
		throw error(403, {
			message: 'This link has been disabled'
		});
	}

	// Verify the token belongs to this profile
	const profileVersion = await db.query.profile_versions.findFirst({
		where: eq(profile_versions.id, token.profile_version),
		columns: { profile_id: true }
	});

	if (!profileVersion || profileVersion.profile_id !== profile.id) {
		throw error(404, {
			message: 'This link is not valid for this profile'
		});
	}

	if (token.expires_at && token.expires_at < new Date()) {
		throw error(403, {
			message: 'This link has expired'
		});
	}

	if (token.visit_limit !== null && token.visit_count >= token.visit_limit) {
		throw error(403, {
			message: 'This link has reached its view limit'
		});
	}

	// Determine format and view mode (defaults)
	const format = token.format || DEFAULT_FORMAT;
	const viewMode = token.view_mode || DEFAULT_VIEW_MODE;

	// `?lang=` picks the document language, as on the public resume/CV routes.
	// The base or an unknown locale renders the English original.
	const langParam = url.searchParams.get('lang');
	const locale = isKnownLocale(langParam) && langParam !== BASE_LOCALE ? langParam : null;

	// If view_mode is PDF, redirect to the appropriate PDF route with token.
	// A portfolio has no PDF route — it is a site, not a document — so such a
	// link renders the site rather than 404ing on a path that does not exist.
	if (viewMode === 'pdf' && format !== 'portfolio') {
		const pdfPath = format === 'cv' ? 'cv.pdf' : 'resume.pdf';
		const langQuery = locale ? `&lang=${locale}` : '';
		redirect(302, `/p/${slug}/${pdfPath}?t=${tokenString}${langQuery}`);
	}

	// Increment visit counter (for HTML view - PDF view increments in its own route)
	await incrementTokenVisit(token.id, getClientAddress());

	// Overlay the locale's translations onto the profile tree (in place), as the
	// public routes do, so ProfileDisplay stays language-agnostic.
	const translator = await loadTranslator(profile.id, locale);
	applyTranslations(profile, translator);

	// Then the wording the shared version picked, after those translations. This
	// route has no template, so the third overlay does not apply here — see
	// server/profile/field-variants.ts for the order the other two keep.
	applyFieldVariants(
		profile,
		await loadFieldVariants(profile.id, token.profile_version, translator)
	);

	// A portfolio link needs a theme to render with, and the token names a
	// version, not a theme.
	//
	// The published theme first, so a shared portfolio and the public site look
	// the same and changing the theme changes both. Failing that, the profile's
	// first portfolio theme: a private link is explicitly the way to show
	// someone the site BEFORE publishing it, so "nothing published" is a normal
	// state here, and falling all the way through to the renderer's defaults
	// would show the recipient a page that looks nothing like the theme the
	// applicant designed. Only a profile with no themes at all renders bare.
	//
	// Both lookups pin kind=portfolio, so neither can reach a CV template.
	let theme = null;
	if (format === 'portfolio') {
		theme = profile.public_portfolio_theme_id
			? await getPortfolioThemeById(profile.id, profile.public_portfolio_theme_id)
			: null;
		if (!theme) theme = (await getPortfolioThemesForProfile(profile.id))[0] ?? null;
	}

	return {
		// Stripped of the wording library before it is serialised into the page:
		// the variants are in the tree for the server's benefit only, and a
		// public document must not carry the alternatives it did not use.
		profile: {
			...withoutFieldVariants(profile),
			profile_versions: profile.profile_versions
		},
		locale: translator.locale,
		versionId: token.profile_version,
		format,
		theme
	};
};
