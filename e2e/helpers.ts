/**
 * E2E test helpers — HTTP utilities for smoke testing against the live dev server.
 *
 * BASE_URL is the URL to send requests to (can be localhost or the public domain).
 * ORIGIN is the Origin header value — must match SJS_APP_URL_HOST in the server's env,
 * since Better Auth validates origins. Defaults to BASE_URL if not set separately.
 */

export const BASE_URL = process.env.SJS_TEST_URL || "http://localhost:5173";
/** Must match SJS_APP_URL_HOST on the server (Better Auth validates Origin). */
const ORIGIN = process.env.SJS_TEST_ORIGIN || process.env.SJS_APP_URL_HOST || BASE_URL;

const TEST_USER = {
  email: "alex.morgan@example.com",
  password: "testpassword123",
};

/** Raw cookie string from sign-in (cached per test suite) */
let sessionCookie: string | null = null;

/**
 * Sign in as the test user and cache the session cookie.
 */
export async function signIn(): Promise<string> {
  if (sessionCookie) return sessionCookie;

  const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": ORIGIN,
    },
    body: JSON.stringify(TEST_USER),
    redirect: "manual",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Sign-in failed (${res.status}): ${body}\n` +
      `Make sure the test user exists (npm run docker:seed:test-user from oss/)`,
    );
  }

  const setCookies = res.headers.getSetCookie();
  sessionCookie = setCookies
    .map((c) => c.split(";")[0])
    .join("; ");

  if (!sessionCookie) {
    throw new Error("Sign-in succeeded but no session cookie was returned");
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
export async function request(
  path: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { auth = true, method = "GET", body, redirect = "manual" } = options;

  const headers: Record<string, string> = {
    "Origin": ORIGIN,
  };

  if (auth) {
    const cookie = await signIn();
    headers["Cookie"] = cookie;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect,
  });
}

/**
 * Assert a page returns 200 and contains expected HTML markers.
 */
export async function expectPage(
  path: string,
  options: FetchOptions & { contains?: string[] } = {},
) {
  const { contains = [], ...fetchOpts } = options;
  const res = await request(path, fetchOpts);

  if (res.status !== 200) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(
      `Expected 200 for ${path}, got ${res.status}\n${body.substring(0, 500)}`,
    );
  }

  if (contains.length > 0) {
    const html = await res.text();
    for (const needle of contains) {
      if (!html.includes(needle)) {
        throw new Error(
          `Expected ${path} to contain "${needle}" but it didn't.\n` +
          `First 500 chars: ${html.substring(0, 500)}`,
        );
      }
    }
  }

  return res;
}
