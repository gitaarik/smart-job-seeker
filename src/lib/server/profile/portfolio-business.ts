/**
 * The applicant's business details in a showcase portfolio's footer.
 *
 * The Business tab's columns are private (PRIVATE_PROFILE_COLUMNS in
 * server/profile/page-profile.ts): no resume, CV or public page carries them.
 * A freelancer's own site is the one place they belong, where a client looks
 * for the registration and VAT numbers an invoice needs. So a showcase theme
 * opts in (`businessFooter`), and the load passes this block beside the page
 * profile rather than moving the columns onto the public list, which would put
 * them on every page.
 */

import type { PortfolioTheme } from '$lib/portfolio-themes';
import { themeLayout } from '$lib/portfolio-themes';

/** What the footer prints. Each line null when its column is empty. */
export interface PortfolioBusiness {
	name: string | null;
	street: string | null;
	/** Postal code and city on one line, the way an address is written. */
	place: string | null;
	/** The profile's country, by name. The Business tab has no country of its own. */
	country: string | null;
	vatId: string | null;
	registration: string | null;
	/** What the registration number is called: the KvK's own name in the Netherlands. */
	registrationLabel: string;
}

interface BusinessColumns {
	company_name?: string | null;
	street_address?: string | null;
	postal_code?: string | null;
	city?: string | null;
	vat_id?: string | null;
	kvk_number?: string | null;
	country_code?: string | null;
}

const countryName = (code: string | null | undefined): string | null => {
	if (!code || !/^[a-z]{2}$/i.test(code)) return null;
	return (
		new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' }).of(code.toUpperCase()) ??
		null
	);
};

const line = (...parts: (string | null | undefined)[]): string | null =>
	parts
		.map((part) => part?.trim())
		.filter(Boolean)
		.join(' ') || null;

/** The footer's business block, or null when the theme does not show one or there is nothing in it. */
export function portfolioBusiness(
	profile: BusinessColumns,
	theme: PortfolioTheme | null
): PortfolioBusiness | null {
	if (!theme || themeLayout(theme.config) !== 'showcase' || !theme.config.businessFooter) {
		return null;
	}
	const cityOnly = !!theme.config.businessCityOnly;
	const business: PortfolioBusiness = {
		name: line(profile.company_name),
		street: cityOnly ? null : line(profile.street_address),
		place: cityOnly ? line(profile.city) : line(profile.postal_code, profile.city),
		country: null,
		vatId: line(profile.vat_id),
		registration: line(profile.kvk_number),
		registrationLabel: profile.country_code?.toUpperCase() === 'NL' ? 'KVK' : 'Registration no.'
	};
	const { name, street, place, vatId, registration } = business;
	if (![name, street, place, vatId, registration].some(Boolean)) return null;
	// Under an address only: a country alone, or under a bare VAT ID, is not one.
	if (street || place) business.country = countryName(profile.country_code);
	return business;
}
