/**
 * The profile tree as the page that renders it may carry it.
 *
 * A SvelteKit `load` serialises whatever it returns into the page, and the four
 * routes that render a profile (the resume, the CV, a share link and the
 * portfolio) returned the tree `getProfileByIdentifier` builds: every column of
 * the profile row and every published version, because the server needs all of
 * it before it renders. Nothing printed most of it, and anyone who opened the
 * page source could read all of it: the applicant's salary ask and freelance
 * rate, street address and postal code, KvK and VAT numbers, user id and
 * browser fingerprint, and the name of every version they had made. Twenty-four
 * of the dev profile's twenty-seven versions were tailored to one application
 * and named after it ("Senior AI Software Engineer — Booking.com"), so the
 * public CV was a list of where its owner was applying, with the tailoring
 * run's reason beside each decision. Found 2026-10-12, on dev and on preview.
 *
 * withoutFieldVariants was the same lesson learned once already, for the
 * wordings a version did not pick. This applies it and goes on from there, at
 * the one place every route hands the tree over.
 */

import { isAnonymous } from '$lib/resume-anonymity';
import { anonymiseTree, identityOf } from '$lib/server/profile/anonymity';
import { withoutFieldVariants } from '$lib/server/profile/field-variants';
import { versionChain } from '$lib/server/profile/skill-words';

/**
 * Profile columns a page may carry: what the renderers print, and the
 * pointers and dates that say nothing about the person.
 *
 * Every column of `profiles` is in exactly one of these two lists, and
 * page-profile.test.ts fails until a new one is, so a column added later is
 * decided about rather than shipped by default, which is how the salary asks
 * reached the page: the day they were added to the row.
 */
export const PAGE_PROFILE_COLUMNS = [
	'id',
	'slug',
	'name',
	'title',
	'subtitle',
	'headline',
	'summary',
	'about_me_text',
	'core_stack',
	'email_address',
	'phone_number',
	'personal_website',
	'linkedin_profile',
	'github_profile',
	'stackoverflow_profile',
	'npm_profile',
	'pypi_profile',
	'nationality',
	'location',
	'location_url',
	'location_timezone',
	'country_code',
	'profile_photo_path',
	'meta_image_url',
	'dev_start_year',
	'python_js_start_year',
	'remote_start_year',
	'public_cv_version_id',
	'public_resume_version_id',
	'public_portfolio_version_id',
	'public_portfolio_theme_id',
	'is_default',
	'sort',
	'date_created',
	'date_updated'
] as const;

/**
 * Profile columns no page carries: money, the address and registrations of
 * the applicant's business, the account and its device, notification
 * settings, and contact channels no document prints.
 */
export const PRIVATE_PROFILE_COLUMNS = [
	'user_id',
	'salary_employed',
	'salary_freelance',
	'salary_adjustments',
	'company_name',
	'street_address',
	'postal_code',
	'vat_id',
	'kvk_number',
	'whatsapp_number',
	'signal_profile',
	'telegram_username',
	'source_cv',
	'browser_user_agent',
	'browser_language',
	'browser_timezone',
	'browser_country_code',
	'browser_profile_id',
	'ui_preferences',
	'email_digest_enabled',
	'email_digest_frequency_days',
	'email_digest_min_score',
	'email_digest_last_sent_at',
	'email_digest_preferred_hour',
	'email_digest_send_to'
] as const;

type PrivateColumn = (typeof PRIVATE_PROFILE_COLUMNS)[number];

/** A version as the tree holds it, as far as this module reads it. */
interface TreeVersion {
	id: number;
	slug: string | null;
	toggles: unknown;
	extension_links: Array<{ id: number; extended_id: number | null; extender_id: number | null }>;
	overrides?: unknown;
}

/**
 * A version as the page gets it: what createProfileFilter walks and applies.
 *
 * No name, because a version made for one application is named after it. No
 * reason or source on its decisions, because those are the tailoring run's
 * notes to the applicant, not part of the document.
 */
export interface PageVersion {
	id: number;
	slug: string | null;
	toggles: unknown;
	extension_links: Array<{ id: number; extended_id: number | null; extender_id: number | null }>;
	overrides: Array<{ entity_type: string; entity_id: number; action: string; sort: number | null }>;
}

export type PageProfile<T> = Omit<T, PrivateColumn | 'field_variants' | 'profile_versions'> & {
	profile_versions: PageVersion[];
};

/**
 * The versions the page renders with: the one it shows and everything it
 * builds on, which is all the renderer's filter ever reads. None for a page
 * that shows no version.
 */
function pageVersions(
	versions: ReadonlyArray<TreeVersion>,
	versionId: number | null | undefined
): PageVersion[] {
	if (!versionId) return [];
	const chain = new Set(versionChain(versions, versionId));
	return versions
		.filter((version) => chain.has(version.id))
		.map((version) => ({
			id: version.id,
			slug: version.slug,
			toggles: version.toggles,
			extension_links: version.extension_links.map((link) => ({
				id: link.id,
				extended_id: link.extended_id,
				extender_id: link.extender_id
			})),
			overrides: (Array.isArray(version.overrides) ? version.overrides : []).map(
				(row: {
					entity_type: string;
					entity_id: number;
					action: string;
					sort?: number | null;
				}) => ({
					entity_type: row.entity_type,
					entity_id: row.entity_id,
					action: row.action,
					sort: row.sort ?? null
				})
			)
		}));
}

/** Whether the page renders an anonymous version: one in its chain says so. */
export function pageIsAnonymous(page: { profile_versions: ReadonlyArray<{ toggles: unknown }> }) {
	return page.profile_versions.some((version) => isAnonymous(version.toggles));
}

/**
 * The tree a document route returns for the page to render.
 *
 * `versionId` is the version the renderer will apply: the one the load
 * resolved, or the `?version=` slug it falls back to (renderedVersionId).
 * Applied after the overlays, which need the whole tree. `locale` is the
 * document's, for the words an anonymous one prints in place of a name.
 */
export function pageProfile<T extends { profile_versions?: ReadonlyArray<TreeVersion> | null }>(
	profile: T,
	versionId: number | null | undefined,
	locale: string | null = null
): PageProfile<T> {
	// Read before the private columns go: the applicant's own company name is
	// one of them, and it is how an anonymous page recognises their business.
	const identity = identityOf(profile);
	const page: Record<string, unknown> = { ...withoutFieldVariants(profile) };
	for (const column of PRIVATE_PROFILE_COLUMNS) delete page[column];
	const versions = pageVersions(profile.profile_versions ?? [], versionId);
	page.profile_versions = versions;
	if (pageIsAnonymous({ profile_versions: versions })) anonymiseTree(page, identity, locale);
	return page as PageProfile<T>;
}
