/**
 * The header pair that authenticates as an arbitrary user.
 *
 * This guard has exactly one job and one failure mode, and the failure mode is
 * the worst one in the app: say yes to a request that should have been a
 * stranger, and the caller becomes whichever user the request named. It was
 * live for the whole life of the feature, on every environment, because the
 * secret it compared against had a public default — so the case that matters
 * most here is not "wrong secret is refused" but "the placeholder is refused
 * even when it is what the config says", which is what fails closed means.
 *
 * The bypass is a pure function of (headers, configured secret): no database,
 * no session, no clock. Every case below is therefore the whole decision, not
 * a slice of it.
 */
import { describe, expect, it } from 'vitest';
import {
	BURNED_RENDER_SECRET,
	internalRenderEnabled,
	internalRenderUserId
} from '../internal-render';

const REAL = 'a-real-secret-nobody-else-has';

/** The headers the legitimate renderer sends. */
function renderHeaders(secret: string | null, userId: string | null): Headers {
	const h = new Headers();
	if (secret !== null) h.set('x-internal-render-secret', secret);
	if (userId !== null) h.set('x-internal-user-id', userId);
	return h;
}

describe('internalRenderEnabled', () => {
	it('is off when nothing is configured', () => {
		expect(internalRenderEnabled('')).toBe(false);
		expect(internalRenderEnabled(undefined)).toBe(false);
		expect(internalRenderEnabled(null)).toBe(false);
	});

	it('is off for the burned public placeholder', () => {
		expect(internalRenderEnabled(BURNED_RENDER_SECRET)).toBe(false);
	});

	it('is on for a real configured secret', () => {
		expect(internalRenderEnabled(REAL)).toBe(true);
	});
});

describe('internalRenderUserId', () => {
	it('authenticates the renderer as the user it names', () => {
		expect(internalRenderUserId(renderHeaders(REAL, 'user-123'), REAL)).toBe('user-123');
	});

	it('reads the header names case-insensitively, as the renderer sends them', () => {
		const h = new Headers();
		h.set('X-Internal-Render-Secret', REAL);
		h.set('X-Internal-User-ID', 'user-123');
		expect(internalRenderUserId(h, REAL)).toBe('user-123');
	});

	describe('refuses when the deployment has not opted in', () => {
		it('with no secret configured, however convincing the headers', () => {
			expect(internalRenderUserId(renderHeaders('anything', 'user-123'), '')).toBeNull();
			expect(internalRenderUserId(renderHeaders('', 'user-123'), '')).toBeNull();
		});

		// The live bypass, in one case: the config held the oss default, and so
		// did every request that wanted in.
		it('with the burned placeholder configured AND presented', () => {
			expect(
				internalRenderUserId(renderHeaders(BURNED_RENDER_SECRET, 'user-123'), BURNED_RENDER_SECRET)
			).toBeNull();
		});
	});

	describe('refuses when the request does not hold the secret', () => {
		it('presenting a different secret', () => {
			expect(internalRenderUserId(renderHeaders('not-it', 'user-123'), REAL)).toBeNull();
		});

		it('presenting a near miss', () => {
			expect(internalRenderUserId(renderHeaders(REAL.toUpperCase(), 'user-123'), REAL)).toBeNull();
			expect(internalRenderUserId(renderHeaders(REAL.slice(0, -1), 'user-123'), REAL)).toBeNull();
			expect(internalRenderUserId(renderHeaders(`${REAL}x`, 'user-123'), REAL)).toBeNull();
		});

		it('presenting no secret header at all', () => {
			expect(internalRenderUserId(renderHeaders(null, 'user-123'), REAL)).toBeNull();
		});

		it('presenting an empty secret header', () => {
			expect(internalRenderUserId(renderHeaders('', 'user-123'), REAL)).toBeNull();
		});
	});

	// Not a hole: `Headers` strips surrounding whitespace on the way in, per the
	// Fetch spec, so the request that arrives with a padded secret is the request
	// that sent the right one. Written down because it looks like a near miss and
	// is not — the comparison never sees the padding.
	it('sees a padded secret as the secret, because HTTP normalises it away', () => {
		expect(internalRenderUserId(renderHeaders(` ${REAL} `, 'user-123'), REAL)).toBe('user-123');
	});

	describe('refuses when the request names no user', () => {
		it('with the user header absent', () => {
			expect(internalRenderUserId(renderHeaders(REAL, null), REAL)).toBeNull();
		});

		// Otherwise the request authenticates as `{ id: '' }` — a user nothing
		// matches, which every falsy-id check downstream would have to defend
		// against on its own.
		it('with the user header empty', () => {
			expect(internalRenderUserId(renderHeaders(REAL, ''), REAL)).toBeNull();
		});
	});

	it('refuses a request carrying neither header', () => {
		expect(internalRenderUserId(new Headers(), REAL)).toBeNull();
	});
});
