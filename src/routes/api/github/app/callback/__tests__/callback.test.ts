/**
 * Tests for GET /api/github/app/callback.
 *
 * This route decides which GitHub installation belongs to which of our users,
 * so the thing worth testing is the refusal. `state` only proves the browser is
 * a signed-in user who started an install; `installation_id` is an enumerable
 * integer in the query string, and the app JWT can read every installation of
 * the app. Trusting the pair would let a signed-in attacker replay their own
 * valid state with someone else's installation id and have it stored against
 * their account — after which a scan would mint a real token for it.
 *
 * So each test below is one way that must not happen.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
	userId: 'user-attacker',
	verified: null as { userId: string; returnTo: string } | null,
	userToken: null as string | null,
	reachable: [] as number[],
	saved: [] as { userId: string; installationId: number }[]
};

vi.mock('$lib/server/utils/api-helpers', () => ({
	requireAuth: () => ({ id: state.userId })
}));

vi.mock('$lib/server/github/app-state', () => ({
	verifyInstallState: () => state.verified
}));

vi.mock('$lib/server/github/app-auth', () => ({
	isGitHubAppConfigured: () => true,
	createAppJwt: () => 'jwt',
	exchangeUserCode: async () => state.userToken,
	userInstallationIds: async () => state.reachable,
	saveInstallation: async (userId: string, installationId: number) => {
		state.saved.push({ userId, installationId });
	}
}));

import { GET } from '../+server';

const VICTIM_INSTALLATION = 4242;

function call(params: Record<string, string>) {
	const url = new URL('https://app.test/api/github/app/callback');
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
	return GET({ locals: {}, url } as never);
}

/**
 * The route throws for every outcome — an HttpError, or a Redirect.
 *
 * Takes `unknown` rather than `Promise`: a SvelteKit handler is allowed to be
 * synchronous, so `MaybePromise<Response>` is the type `GET` actually has.
 */
async function outcome(promise: unknown) {
	try {
		await promise;
		return { status: 0 };
	} catch (thrown) {
		return thrown as { status: number; body?: { message: string }; location?: string };
	}
}

beforeEach(() => {
	state.userId = 'user-attacker';
	state.verified = { userId: 'user-attacker', returnTo: '/profile' };
	state.userToken = 'ghu_token';
	state.reachable = [];
	state.saved = [];
	// fetchInstallationAccount — only reached once ownership is proven.
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ account: { login: 'victim', type: 'User' } })
		})
	);
});

describe('installation ownership', () => {
	it('refuses an id the user cannot reach on GitHub', async () => {
		// The whole attack in one case: a valid session, a valid state the
		// attacker legitimately obtained, and someone else's installation id.
		state.reachable = [11, 12];
		const result = await outcome(
			call({ state: 'valid', installation_id: String(VICTIM_INSTALLATION), code: 'c' })
		);
		expect(result.status).toBe(403);
		expect(state.saved).toEqual([]);
	});

	it('refuses when GitHub sent no code to prove identity with', async () => {
		// Fails closed rather than falling back to the unverified path, which is
		// what makes "OAuth during installation" a hard requirement of the app.
		state.reachable = [VICTIM_INSTALLATION];
		const result = await outcome(
			call({ state: 'valid', installation_id: String(VICTIM_INSTALLATION) })
		);
		expect(result.status).toBe(400);
		expect(state.saved).toEqual([]);
	});

	it('refuses when the code will not exchange', async () => {
		state.userToken = null;
		state.reachable = [VICTIM_INSTALLATION];
		const result = await outcome(
			call({ state: 'valid', installation_id: String(VICTIM_INSTALLATION), code: 'stale' })
		);
		expect(result.status).toBe(502);
		expect(state.saved).toEqual([]);
	});

	it('refuses a state signed for a different user', async () => {
		state.verified = { userId: 'someone-else', returnTo: '/profile' };
		state.reachable = [VICTIM_INSTALLATION];
		const result = await outcome(
			call({ state: 'valid', installation_id: String(VICTIM_INSTALLATION), code: 'c' })
		);
		expect(result.status).toBe(400);
		expect(state.saved).toEqual([]);
	});

	it('stores it when the user really can reach that installation', async () => {
		state.reachable = [VICTIM_INSTALLATION];
		const result = await outcome(
			call({ state: 'valid', installation_id: String(VICTIM_INSTALLATION), code: 'c' })
		);
		expect(result.status).toBe(302);
		expect(state.saved).toEqual([{ userId: 'user-attacker', installationId: VICTIM_INSTALLATION }]);
	});

	it('returns quietly with nothing stored when there is no installation id', async () => {
		// GitHub sends people here after requesting an org install they cannot
		// perform themselves.
		const result = await outcome(call({ state: 'valid' }));
		expect(result.status).toBe(302);
		expect(state.saved).toEqual([]);
	});
});
