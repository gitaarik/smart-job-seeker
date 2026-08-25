import { error, redirect } from '@sveltejs/kit';
import { getProfileByIdentifier } from '$lib/server/profile/default';
import { incrementTokenVisit } from '$lib/server/auth/token-validation';
import { hashToken } from '$lib/server/auth/token-generator';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { profile_tokens, profile_versions } from '$lib/server/db/schema';
import { DEFAULT_FORMAT, DEFAULT_VIEW_MODE } from '$lib/profile-tokens';
import { BASE_LOCALE, isKnownLocale } from '$lib/resume-translations';
import { applyTranslations, loadTranslator } from '$lib/server/profile/translations';
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

	// If view_mode is PDF, redirect to the appropriate PDF route with token
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

	return {
		profile: {
			...profile,
			profile_versions: profile.profile_versions
		},
		locale: translator.locale,
		versionId: token.profile_version,
		format
	};
};
