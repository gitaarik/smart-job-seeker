/**
 * The internal-render bypass, as a decision one function makes.
 *
 * `x-internal-render-secret` plus `x-internal-user-id` authenticate a request
 * as an arbitrary user — no session, no password, no cookie. It exists so the
 * PDF renderer can fetch a profile page as its owner over loopback
 * (`profile/page-fit.ts`, `profile/generate-version-pdfs.ts`), which makes it
 * the most dangerous pair of headers this app reads.
 *
 * For the whole life of the feature it was also the easiest pair to send: the
 * secret defaulted to `dev-internal-render-secret`, that default was public in
 * the oss repo, and no environment overrode it — so anyone who sent the two
 * headers became whoever they named. Fixed 2026-08-19 (oss `184eb672`); this
 * module is that fix lifted out of `handle`, because a guard whose failure mode
 * is "authenticates as anyone" should be testable without standing up a
 * SvelteKit event.
 *
 * Fail-closed: the bypass is off unless the deployment opted in with a real
 * secret. Two configured values are not real ones — the empty string (nothing
 * set) and the burned placeholder (set, but to a value everyone has).
 *
 * The public edge additionally strips both headers from inbound requests (see
 * `caddy/sites/{dev,preview,prod}`), so this is the second of two locks, not
 * the only one.
 */

/**
 * The default that shipped in the oss repo, and therefore a secret in name
 * only. Configuring it is the same as configuring nothing.
 */
export const BURNED_RENDER_SECRET = 'dev-internal-render-secret';

/** Whether the deployment has opted into the bypass at all. */
export function internalRenderEnabled(configured: string | null | undefined): boolean {
	return !!configured && configured !== BURNED_RENDER_SECRET;
}

/**
 * The user id this request may act as, or `null` for every other request —
 * which is every request that is not the renderer calling itself.
 *
 * Returning the id rather than a boolean keeps the caller from having to read
 * the header a second time, and keeps "which user" inside the check that
 * decided the request was allowed to name one at all.
 */
export function internalRenderUserId(
	headers: Headers,
	configured: string | null | undefined
): string | null {
	if (!internalRenderEnabled(configured)) return null;

	const presented = headers.get('x-internal-render-secret');
	const userId = headers.get('x-internal-user-id');

	// An empty user id is not a user. Without this the pair would authenticate
	// as `{ id: '' }`, which no lookup matches and every ownership check on a
	// falsy id has to defend against separately.
	if (!presented || !userId) return null;
	if (presented !== configured) return null;

	return userId;
}
