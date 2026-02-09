/**
 * Auth Guard Utilities
 *
 * Helper functions for protecting routes.
 */

import { redirect } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";

/**
 * Require authentication. Redirects to login if not authenticated.
 */
export function requireAuth(event: RequestEvent) {
  if (!event.locals.user) {
    const redirectTo = encodeURIComponent(event.url.pathname + event.url.search);
    redirect(302, `/login?redirect=${redirectTo}`);
  }
  return event.locals.user;
}

/**
 * Redirect if already authenticated. Use in login/signup pages.
 */
export function redirectIfAuthenticated(event: RequestEvent, to = "/") {
  if (event.locals.user) {
    redirect(302, to);
  }
}
