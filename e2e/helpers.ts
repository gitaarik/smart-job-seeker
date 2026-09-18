/**
 * E2E test helpers — HTTP utilities for smoke testing against the live dev server.
 *
 * BASE_URL is the URL to send requests to (can be localhost or the public domain).
 * ORIGIN is the Origin header value — must match SJS_APP_URL_HOST in the server's env,
 * since Better Auth validates origins. Defaults to BASE_URL if not set separately.
 */

export const BASE_URL = process.env.SJS_TEST_URL || 'http://localhost:5173';
/** Must match SJS_APP_URL_HOST on the server (Better Auth validates Origin). */
const ORIGIN = process.env.SJS_TEST_ORIGIN || process.env.SJS_APP_URL_HOST || BASE_URL;

const TEST_USER = {
	email: 'alex.morgan@example.com',
	password: 'testpassword123'
};

/** Raw cookie string from sign-in (cached per test suite) */
let sessionCookie: string | null = null;

/**
 * Sign in as the test user and cache the session cookie.
 */
export async function signIn(): Promise<string> {
	if (sessionCookie) return sessionCookie;

	const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Origin: ORIGIN
		},
		body: JSON.stringify(TEST_USER),
		redirect: 'manual'
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(
			`Sign-in failed (${res.status}): ${body}\n` +
				`Make sure the test user exists (npm run docker:seed:test-user from oss/)`
		);
	}

	const setCookies = res.headers.getSetCookie();
	sessionCookie = setCookies.map((c) => c.split(';')[0]).join('; ');

	if (!sessionCookie) {
		throw new Error('Sign-in succeeded but no session cookie was returned');
	}

	return sessionCookie;
}

/** Clear the cached session (call in afterAll if needed). */
export function clearSession() {
	sessionCookie = null;
}

type FetchOptions = {
	/** Include session cookie (default: true) */
	auth?: boolean;
	/** HTTP method (default: GET) */
	method?: string;
	/** Request body (JSON-serialized) */
	body?: unknown;
	/** Follow redirects (default: false — so we can assert on redirect targets) */
	redirect?: RequestRedirect;
};

/**
 * Fetch a page or API endpoint from the dev server.
 * By default, includes the session cookie and doesn't follow redirects.
 */
export async function request(path: string, options: FetchOptions = {}): Promise<Response> {
	const { auth = true, method = 'GET', body, redirect = 'manual' } = options;

	const headers: Record<string, string> = {
		Origin: ORIGIN
	};

	if (auth) {
		const cookie = await signIn();
		headers['Cookie'] = cookie;
	}

	if (body !== undefined) {
		headers['Content-Type'] = 'application/json';
	}

	return fetch(`${BASE_URL}${path}`, {
		method,
		headers,
		body: body !== undefined ? JSON.stringify(body) : undefined,
		redirect
	});
}

/**
 * Assert a page returns 200 and contains expected HTML markers.
 */
export async function expectPage(
	path: string,
	options: FetchOptions & { contains?: string[] } = {}
) {
	const { contains = [], ...fetchOpts } = options;
	const res = await request(path, fetchOpts);

	if (res.status !== 200) {
		const body = await res.text().catch(() => '(no body)');
		throw new Error(`Expected 200 for ${path}, got ${res.status}\n${body.substring(0, 500)}`);
	}

	if (contains.length > 0) {
		const html = await res.text();
		for (const needle of contains) {
			if (!html.includes(needle)) {
				throw new Error(
					`Expected ${path} to contain "${needle}" but it didn't.\n` +
						`First 500 chars: ${html.substring(0, 500)}`
				);
			}
		}
	}

	return res;
}

/** Session cookie plus the selected-profile cookie (cached per test suite). */
let profileSessionCookie: string | null = null;

/**
 * Sign in AND select a profile, the way opening the app does.
 *
 * A form action reads the profile from the `selected_profile_id` cookie rather
 * than from the layout data, so a POST straight after sign-in fails with "No
 * profile selected" even though every page renders. Loading /home once is what
 * sets that cookie, and a browser does it before the user can click anything.
 */
export async function signInWithProfile(): Promise<string> {
	if (profileSessionCookie) return profileSessionCookie;

	const session = await signIn();
	const res = await fetch(`${BASE_URL}/home`, {
		headers: { Origin: ORIGIN, Cookie: session },
		redirect: 'manual'
	});
	const selected = res.headers
		.getSetCookie()
		.map((c) => c.split(';')[0])
		.find((c) => c.startsWith('selected_profile_id='));

	profileSessionCookie = selected ? `${session}; ${selected}` : session;
	return profileSessionCookie;
}

/**
 * POST a SvelteKit form action.
 *
 * Actions take form encoding; `request` sends JSON, which they reject with 415.
 * The response body is the action's serialized result, so a caller can tell a
 * `failure` from a `success` rather than only reading the status.
 */
export async function formAction(
	path: string,
	fields: Record<string, string | number> = {}
): Promise<{ status: number; type: string; body: string }> {
	const cookie = await signInWithProfile();
	const body = new URLSearchParams();
	for (const [key, value] of Object.entries(fields)) body.set(key, String(value));

	const res = await fetch(`${BASE_URL}${path}`, {
		method: 'POST',
		headers: {
			Origin: ORIGIN,
			Cookie: cookie,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body,
		redirect: 'manual'
	});

	const text = await res.text();
	let type = 'unknown';
	try {
		type = String(JSON.parse(text).type ?? 'unknown');
	} catch {
		// A redirect or an HTML error page carries no action envelope.
	}
	return { status: res.status, type, body: text };
}
