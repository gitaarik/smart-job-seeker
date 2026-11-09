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
import { applyFieldVariants, loadFieldVariants } from '$lib/server/profile/field-variants';
import { pageProfile } from '$lib/server/profile/page-profile';
import { givePortfolioKey } from '$lib/server/profile/portfolio-key';
import { portfolioHrefs } from '$lib/server/profile/portfolio-pages';
import { hasPrivateCv } from '$lib/portfolio-themes';
import {
	applySkillWords,
	loadDocumentSkillWords,
	renderedVersionId
} from '$lib/server/profile/skill-words';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals, cookies, getClientAddress }) => {
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

	// A portfolio link opens a site, not a document, so it is not rendered
	// here: it leaves its key in the visitor's browser and goes to the site,
	// to the private CV page when the theme keeps the career on one, else to
	// the site's one page. The key is what opens either from then on, so the
	// visitor can come back without the link (server/profile/portfolio-key.ts).
	// Its view mode does not matter: a site has no PDF.
	//
	// The theme as the site picks it: the published one, else the profile's
	// first, because a link is how a site is shown to someone before it is
	// published (see the portfolio route).
	if (format === 'portfolio') {
		await incrementTokenVisit(token.id, getClientAddress());
		givePortfolioKey(cookies, url, profile.id, tokenString, token.expires_at);
		const theme =
			(profile.public_portfolio_theme_id
				? await getPortfolioThemeById(profile.id, profile.public_portfolio_theme_id)
				: null) ?? (await getPortfolioThemesForProfile(profile.id))[0];
		const hrefs = portfolioHrefs(profile.slug ?? slug, url, false);
		redirect(303, theme && hasPrivateCv(theme.config) ? hrefs.cv : hrefs.home);
	}

	// If view_mode is PDF, redirect to the appropriate PDF route with token.
	if (viewMode === 'pdf') {
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
	locals.documentLocale = translator.locale;

	// Then the wording the shared version prints, after those translations — see
	// server/profile/field-variants.ts for why in that order.
	applyFieldVariants(
		profile,
		await loadFieldVariants(profile.id, token.profile_version, translator)
	);

	// And the skill words the shared version carries — see
	// server/profile/skill-words.ts.
	const shownVersionId = renderedVersionId(
		profile,
		token.profile_version,
		url.searchParams.get('version')
	);
	applySkillWords(
		profile,
		await loadDocumentSkillWords(profile, shownVersionId),
		format,
		shownVersionId
	);

	// Only what the page renders: the tree is serialised into it, and the rest
	// of it is private. See server/profile/page-profile.ts.
	return {
		profile: pageProfile(profile, shownVersionId, translator.locale),
		locale: translator.locale,
		versionId: token.profile_version,
		format
	};
};
