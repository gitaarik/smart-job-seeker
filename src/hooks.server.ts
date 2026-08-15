import type { Handle, HandleServerError } from '@sveltejs/kit';
import { json, redirect } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '$lib/server/auth/better-auth';
import type { User } from '$lib/server/auth/better-auth';
import { config } from '$lib/server/config';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { users } from '$lib/server/db/schema';
import { initSentry, Sentry } from '$lib/server/monitoring/sentry';
import { aiRateLimiter, createRateLimitResponse } from '$lib/server/middleware/rate-limit';

initSentry('sveltekit');

// API routes that don't require session auth (they handle their own auth or are public)
const PUBLIC_API_ROUTES = [
	'/api/auth', // Better Auth handles its own auth
	'/api/verify-turnstile', // Public CAPTCHA verification
	'/api/jobs/import', // Uses API key auth
	// The MCP server. Authenticates on an Authorization bearer token against
	// `mcp_keys` — a separate table from the device keys above, deliberately, so
	// that neither kind of credential can be presented where the other belongs.
	'/api/mcp'
];

function getSystemTheme(request: Request): 'light' | 'dark' {
	// Try to detect system preference from headers
	const acceptHeader = request.headers.get('sec-ch-prefers-color-scheme');
	if (acceptHeader === 'dark') {
		return 'dark';
	}

	// Check Accept header for dark mode preference
	const accept = request.headers.get('accept');
	if (accept && accept.includes('dark')) {
		return 'dark';
	}

	// Check for time-based heuristics (rough estimate)
	// This is a fallback when no other indicators are available
	const now = new Date();
	const hour = now.getHours();

	// If it's between 6 PM and 6 AM, lean towards dark theme
	if (hour >= 18 || hour <= 6) {
		return 'dark';
	}

	return 'light';
}

function getThemeFromRequest(request: Request): string {
	// First check for theme preference cookie
	const cookies = request.headers.get('cookie');
	let themePref = 'auto'; // Default to auto for new users

	if (cookies) {
		const themeCookie = cookies.split(';').find((cookie) => cookie.trim().startsWith('theme='));

		if (themeCookie) {
			const theme = themeCookie.split('=')[1]?.trim();
			if (theme === 'dark' || theme === 'light' || theme === 'auto') {
				themePref = theme;
			}
		}
	}

	// If auto, determine actual theme based on system preference
	if (themePref === 'auto') {
		return getSystemTheme(request);
	}

	return themePref;
}

export const handle: Handle = async ({ event, resolve }) => {
	// Internal rendering bypass (for server-side PDF generation)
	const internalSecret = event.request.headers.get('x-internal-render-secret');
	const internalUserId = event.request.headers.get('x-internal-user-id');
	if (internalSecret && internalUserId && internalSecret === config.internalRenderSecret) {
		event.locals.user = { id: internalUserId } as User;
		event.locals.session = null;
		return await resolve(event);
	}

	// Backward compat: redirect old /dashboard/* URLs to new paths
	if (event.url.pathname.startsWith('/dashboard')) {
		const newPath = event.url.pathname.replace(/^\/dashboard/, '') || '/home';
		redirect(301, newPath + event.url.search);
	}

	// Get session and populate locals FIRST, before svelteKitHandler
	// This ensures event.locals is populated when resolve() is called
	try {
		const session = await auth.api.getSession({
			headers: event.request.headers
		});
		event.locals.user = session?.user ?? null;
		event.locals.session = session?.session ?? null;
	} catch {
		// Invalid/expired session - clear locals and let the page handle auth
		event.locals.user = null;
		event.locals.session = null;
	}

	// Admin impersonation
	event.locals.adminUser = null;
	const impersonateId = event.cookies.get('sjs_impersonate');
	if (impersonateId && event.locals.user) {
		if ((event.locals.user as { is_admin?: boolean }).is_admin) {
			const targetUser = await db.query.users.findFirst({
				where: eq(users.id, impersonateId)
			});
			if (targetUser) {
				event.locals.adminUser = event.locals.user;
				event.locals.user = targetUser as User;
			} else {
				event.cookies.delete('sjs_impersonate', { path: '/' });
			}
		} else {
			event.cookies.delete('sjs_impersonate', { path: '/' });
		}
	}

	// Handle Better Auth routes (e.g., /api/auth/*)
	// In dev mode, Vite's dev server always uses http://localhost:PORT as the
	// request origin, which doesn't match the public baseURL behind a reverse
	// proxy. Bypass better-auth's origin check by calling auth.handler directly.
	if (import.meta.env.DEV) {
		const basePath = auth.options.basePath || '/api/auth';
		if (event.url.pathname.startsWith(basePath)) {
			return auth.handler(event.request);
		}
	}

	try {
		const authResponse = await svelteKitHandler({ event, resolve, auth });
		if (authResponse) {
			return authResponse;
		}
	} catch {
		// Session error (e.g., stale token) - clear session cookie and continue
		event.locals.user = null;
		event.locals.session = null;
	}

	// Enforce authentication on all /api/* routes by default.
	// New API routes are secure automatically — only routes in PUBLIC_API_ROUTES skip this.
	const pathname = event.url.pathname;
	if (
		pathname.startsWith('/api/') &&
		!PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))
	) {
		if (!event.locals.user) {
			return json({ error: 'Not authenticated' }, { status: 401 });
		}
		if (!(event.locals.user as { is_approved?: boolean }).is_approved && !event.locals.adminUser) {
			return json({ error: 'Account pending approval' }, { status: 403 });
		}

		// Throttle AI writes, for the same reason the auth gate above is central:
		// a new /api/ai route should be covered by default rather than by
		// remembering. Reads are exempt — opening the assistant fetches a
		// transcript, and that must not spend from the bucket its next turn needs.
		if (pathname.startsWith('/api/ai/') && event.request.method !== 'GET') {
			if (!aiRateLimiter.tryConsumeKey(event.locals.user.id)) {
				return createRateLimitResponse(aiRateLimiter.retryAfterSeconds());
			}
		}
	}

	// Apply theme
	const theme = getThemeFromRequest(event.request);

	return await resolve(event, {
		transformPageChunk: ({ html }) => {
			return html.replace('class="theme-light"', `class="theme-${theme}"`);
		}
	});
};

export const handleError: HandleServerError = ({ error, event }) => {
	if (process.env.SENTRY_DSN) {
		Sentry.captureException(error, {
			extra: { url: event.url.pathname }
		});
	}
	console.error(error);
};
