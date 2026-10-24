/**
 * Contact details on a showcase portfolio: kept out of the page, handed out
 * behind a Turnstile check.
 *
 * The showcase shows a "Get in touch" button that reveals the email and phone
 * only once Cloudflare has judged the visitor human. That gate gates nothing
 * if the details are in the page anyway, and a SvelteKit page carries its load
 * data in the HTML for hydration whether or not the markup prints a field, the
 * lesson `withoutFieldVariants` and `pageProfile` were both learned from. So
 * the load strips them (`withoutContact`), and `POST /p/[slug]/portfolio/contact`
 * returns them once a token checks out.
 *
 * The basic layout prints the email in its header and is left as it is: a
 * theme that wants the gate picks the showcase.
 */

import type { PortfolioTheme } from '$lib/portfolio-themes';
import { themeLayout } from '$lib/portfolio-themes';
import { turnstileConfigured, turnstileSiteKey } from '$lib/server/auth/turnstile';

/** Profile columns the showcase reveals only through the contact endpoint. */
export const CONTACT_FIELDS = ['email_address', 'phone_number'] as const;

/** What the contact endpoint returns. */
export interface PortfolioContact {
	email: string | null;
	phone: string | null;
	timezone: string | null;
}

/** What the page needs to offer the button, in place of the details themselves. */
export interface PortfolioContactGate {
	/** Whether there is anything to reveal at all; no button when there is not. */
	available: boolean;
	/** Null when Turnstile is not configured, and the details come back without a check. */
	siteKey: string | null;
}

/** Whether this theme keeps contact details behind the gate. */
export function gatesContact(theme: PortfolioTheme | null): boolean {
	return !!theme && themeLayout(theme.config) === 'showcase';
}

/**
 * The page profile with its contact columns nulled, plus what the button needs.
 *
 * Nulled rather than dropped, so the tree keeps the shape every renderer is
 * typed against; a null is what an unfilled column already looks like.
 *
 * For every visitor, the owner included: what the owner previews is what a
 * visitor gets, and the owner can open the gate like anyone else.
 */
export function withoutContact<
	T extends { email_address?: string | null; phone_number?: string | null }
>(profile: T): { profile: T; contact: PortfolioContactGate } {
	const { email_address, phone_number } = profile;
	return {
		profile: { ...profile, email_address: null, phone_number: null },
		contact: {
			available: !!email_address || !!phone_number,
			siteKey: turnstileConfigured() ? turnstileSiteKey() : null
		}
	};
}
