/**
 * The key to a portfolio's private CV page.
 *
 * A showcase can keep its career off the public site (`privateCv` in
 * $lib/portfolio-themes.ts) on a page of its own that no search engine and
 * no passing visitor sees. What opens it is a share link of the `portfolio`
 * format, the applicant's own Share Links page: opening one leaves this key
 * in the visitor's browser, so the page stays open to them afterwards, and
 * the public page shows them a way to it.
 *
 * The key is the link's own token, in an httpOnly cookie, and it is checked
 * against the link on every request. Disabling, expiring or deleting the link
 * therefore closes the page to everyone who opened it, with nothing else to
 * revoke. The one check it skips is the visit limit, which counts how often
 * the link is opened rather than how often the page is read (see
 * `TokenValidationOptions`).
 *
 * Path `/`, so the cookie still reaches the page when a custom domain serves
 * the site with its paths rewritten (the planned cut-over of rikwanders.tech
 * in planning/PORTFOLIO-SHOWCASE-LAYOUT.md in sjs-ops). One cookie per
 * profile, named by id, which a renamed slug does not change.
 */

import type { Cookies } from '@sveltejs/kit';
import { validateToken } from '$lib/server/auth/token-validation';

/** The longest a key lasts without the link being opened again: half a year. */
const KEY_MAX_AGE_SECONDS = 60 * 60 * 24 * 182;

/** The cookie holding the key to one profile's portfolio. */
export function portfolioKeyCookie(profileId: number): string {
	return `sjs_portfolio_key_${profileId}`;
}

/** A key that still opens the profile's private pages. */
export interface PortfolioKey {
	token: string;
	tokenId: number;
	/** The version the link was made for, which the private page shows. */
	versionId: number;
}

/**
 * The key this visitor holds for the profile's portfolio, if it still opens
 * it. A key whose link is gone, disabled, expired or not a portfolio link is
 * deleted on the way, so the page stops offering a way in it cannot keep.
 */
export async function readPortfolioKey(
	cookies: Cookies,
	url: URL,
	profileId: number
): Promise<PortfolioKey | null> {
	const name = portfolioKeyCookie(profileId);
	const token = cookies.get(name);
	if (!token) return null;

	const link = await validateToken(token, profileId, { visitLimit: false });
	if (!link.valid || link.format !== 'portfolio' || !link.tokenId || !link.profileVersionId) {
		cookies.delete(name, { path: '/', secure: url.protocol === 'https:' });
		return null;
	}
	return { token, tokenId: link.tokenId, versionId: link.profileVersionId };
}

/**
 * Leave the key in the visitor's browser, for a portfolio link they have just
 * opened. It lasts as long as the link does, and at most half a year.
 */
export function givePortfolioKey(
	cookies: Cookies,
	url: URL,
	profileId: number,
	token: string,
	expiresAt: Date | null | undefined
): void {
	const untilExpiry = expiresAt
		? Math.floor((expiresAt.getTime() - Date.now()) / 1000)
		: KEY_MAX_AGE_SECONDS;
	const maxAge = Math.min(KEY_MAX_AGE_SECONDS, untilExpiry);
	if (maxAge <= 0) return;
	cookies.set(portfolioKeyCookie(profileId), token, {
		path: '/',
		maxAge,
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:'
	});
}
