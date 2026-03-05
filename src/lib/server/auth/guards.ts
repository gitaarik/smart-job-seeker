/**
 * Auth Guard Utilities
 *
 * Helper functions for protecting routes.
 */

import { redirect } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";

/**
 * Require authentication. Redirects to login if not authenticated,
 * or to pending page if not yet approved by an admin.
 */
export function requireAuth(event: RequestEvent) {
  if (!event.locals.user) {
    const redirectTo = encodeURIComponent(
      event.url.pathname + event.url.search,
    );
    redirect(302, `/login?redirect=${redirectTo}`);
  }
  if (!(event.locals.user as { is_approved?: boolean }).is_approved) {
    redirect(302, "/signup/pending");
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
