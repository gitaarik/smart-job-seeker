/**
 * Anonymous documents: a version whose resume and CV say nothing about who the
 * applicant is, for an employer that reads applications without names.
 *
 * Dutch public-sector employers commonly ask for this ("anoniem solliciteren")
 * so the people choosing between candidates are not swayed by a name, an age, a
 * nationality or an address. What the document still says is the work: roles,
 * dates, skills, education.
 *
 * Stored as a token in the version's `toggles`, beside the contact fields'
 * `hide:` tokens and `nationality`, because it is the same kind of decision:
 * what this document says about the person. Toggles are read across the
 * extension chain, so a version built on an anonymous one is anonymous too, and
 * nothing a version adds can turn it back off. An application marked anonymous
 * (`applications.anonymous`) carries it onto its own tailored version.
 *
 * What it removes is decided on the server, before the page is serialised: see
 * server/profile/anonymity.ts. A page that only hid the name would still carry
 * it in its source.
 */

export const ANONYMOUS_TOGGLE = 'anonymous';

/** Whether a version's toggles (or a chain's, aggregated) make its documents anonymous. */
export function isAnonymous(toggles: unknown): boolean {
	return Array.isArray(toggles) && toggles.includes(ANONYMOUS_TOGGLE);
}

/** A version's own toggles with the anonymous token set or cleared, the rest untouched. */
export function withAnonymous(toggles: unknown, anonymous: boolean): string[] {
	const rest = (Array.isArray(toggles) ? toggles : []).filter(
		(t): t is string => typeof t === 'string' && t !== ANONYMOUS_TOGGLE
	);
	return anonymous ? [...rest, ANONYMOUS_TOGGLE] : rest;
}

/** What the leak check (server/profile/anonymity-check.ts) can find in a PDF. */
export type LeakKind =
	'name' | 'business' | 'email' | 'phone' | 'handle' | 'address' | 'registration' | 'hometown';

/** One place a PDF still names the applicant. */
export interface LeakHit {
	kind: LeakKind;
	/** The words found, as the PDF has them. */
	term: string;
	/** The text around them, as the reader will see it. */
	context: string;
}

/** How each kind of hit is named to the applicant. */
export const LEAK_LABELS: Readonly<Record<LeakKind, string>> = {
	name: 'Your name',
	business: 'Your business name',
	email: 'Your email address',
	phone: 'Your phone number',
	handle: 'Your username or website',
	address: 'Your address',
	registration: 'Your KvK or VAT number',
	hometown: 'Your home town'
};

/** What an anonymous document leaves out, in the words the switches use. */
export const ANONYMOUS_DESCRIPTION =
	'No name, contact details, nationality or references, and your own business prints as "Own business". The PDF is then read for anything else that still names you.';
