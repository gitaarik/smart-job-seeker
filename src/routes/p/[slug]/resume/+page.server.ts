import { error } from '@sveltejs/kit';
import { getProfileByIdentifier } from '$lib/server/profile/default';
import { checkProfileAccess, getVersionIdBySlug } from '$lib/server/profile/access-control';
import { incrementTokenVisit } from '$lib/server/auth/token-validation';
import { getResumeTemplate } from '$lib/server/profile/resume-templates';
import { DEFAULT_TEMPLATE_ID } from '$lib/resume-templates';
import { isKnownLocale } from '$lib/resume-translations';
import { applyTranslations, loadTranslator } from '$lib/server/profile/translations';
import { applyFieldVariants, loadFieldVariants } from '$lib/server/profile/field-variants';
import { pageIsAnonymous, pageProfile } from '$lib/server/profile/page-profile';
import { anonymousTemplate } from '$lib/server/profile/anonymity';
import {
	applySkillWords,
	loadDocumentSkillWords,
	renderedVersionId
} from '$lib/server/profile/skill-words';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals, getClientAddress }) => {
	const { slug } = params;
	const token = url.searchParams.get('t');

	// Get profile by slug
	const profile = await getProfileByIdentifier(slug);

	if (!profile) {
		throw error(404, {
			message: `Profile not found: ${slug}`
		});
	}

	// Check access control
	const accessResult = await checkProfileAccess({
		profile,
		token,
		userId: locals.user?.id,
		clientIp: getClientAddress(),
		routeType: 'resume'
	});

	if (!accessResult.allowed) {
		throw error(accessResult.statusCode, {
			message: accessResult.message
		});
	}

	// Increment visit counter if token was used
	if (accessResult.accessType === 'token' && accessResult.tokenId) {
		await incrementTokenVisit(accessResult.tokenId, getClientAddress());
	}

	// Resolve version: from access control, query param, or public version fallback
	let versionId = accessResult.versionId;
	if (!versionId && accessResult.accessType === 'owner') {
		const versionSlug = url.searchParams.get('version');
		if (versionSlug) {
			versionId = (await getVersionIdBySlug(profile.id, versionSlug)) ?? undefined;
		} else if (profile.public_resume_version_id) {
			// Fall back to public version when no specific version requested
			versionId = profile.public_resume_version_id;
		}
	}

	// Resolve the selected presentation template (a DB-backed template config),
	// or null for the built-in default renderer.
	const templateSlug = url.searchParams.get('template');
	const template =
		templateSlug && templateSlug !== DEFAULT_TEMPLATE_ID
			? await getResumeTemplate(profile.id, templateSlug)
			: null;

	// Overlay non-English translations onto the profile tree (in place) so the
	// render components stay language-agnostic. Base/unknown locale is a no-op.
	const langParam = url.searchParams.get('lang');
	const translator = await loadTranslator(profile.id, isKnownLocale(langParam) ? langParam : null);
	applyTranslations(profile, translator);
	locals.documentLocale = translator.locale;

	// Then the wording this version prints for the fields that have alternatives
	// — the profile's title and summary, a role's position — if it or a version
	// it builds on picked any. After the translations, whose language a wording
	// has to match. See server/profile/field-variants.ts for the order.
	applyFieldVariants(profile, await loadFieldVariants(profile.id, versionId, translator));

	// Then the skill words this version carries: a job's own word for something
	// the profile holds under another name, printed on this document only. See
	// server/profile/skill-words.ts. Asked of the version the renderer will
	// apply, which falls back to `?version=` when the load resolved none.
	const shownVersionId = renderedVersionId(profile, versionId, url.searchParams.get('version'));
	applySkillWords(
		profile,
		await loadDocumentSkillWords(profile, shownVersionId),
		'resume',
		shownVersionId
	);

	// Only what the page renders: the tree is serialised into it, and the rest
	// of it is private. See server/profile/page-profile.ts.
	const page = pageProfile(profile, shownVersionId, translator.locale);

	return {
		profile: page,
		locale: translator.locale,
		versionId,
		accessType: accessResult.accessType,
		// Without the brand's contact points when the document is anonymous:
		// they stand in for the applicant's own and name them too.
		template: pageIsAnonymous(page) ? anonymousTemplate(template) : template
	};
};
