/**
 * Auth Guard Utilities
 *
 * Helper functions for protecting routes.
 */

import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Require authentication. Redirects to login if not authenticated,
 * or to pending page if not yet approved by an admin.
 */
export function requireAuth(event: RequestEvent) {
	if (!event.locals.user) {
		const redirectTo = encodeURIComponent(event.url.pathname + event.url.search);
		redirect(302, `/login?redirect=${redirectTo}`);
	}
	if (!(event.locals.user as { is_approved?: boolean }).is_approved && !event.locals.adminUser) {
		redirect(302, '/signup/pending');
	}
	// A pending erasure revokes access to the data without revoking the ability
	// to sign in and see what is happening — the alternative is a login that
	// fails for no stated reason, on the one request where the reason matters
	// most. Admins keep their view so a restore can be checked.
	if (
		(event.locals.user as { deletion_requested_at?: Date | null }).deletion_requested_at &&
		!event.locals.adminUser
	) {
		redirect(302, '/deletion-pending');
	}
	return event.locals.user;
}

/**
 * Require admin access. Redirects to /home if user is not an admin.
 */
export function requireAdmin(event: RequestEvent) {
	const user = requireAuth(event);
	if (
		!(user as { is_admin?: boolean }).is_admin &&
		!(event.locals.adminUser as { is_admin?: boolean } | null)?.is_admin
	) {
		redirect(302, '/home');
	}
	return user;
}

/**
 * Whether this viewer gets the staff-only detail layered onto an ordinary page —
 * the retrieval record under a generated draft, the scoring internals on a job.
 *
 * Not a guard: it never redirects, because the page belongs to the applicant
 * either way and only the extra detail is gated. `is_staff || is_admin` is the
 * line /jobs and /data/ai-changes already draw for exactly this.
 */
export function isStaffViewer(locals: App.Locals): boolean {
	const user = locals.user as { is_staff?: boolean; is_admin?: boolean } | null;
	const impersonating = locals.adminUser as { is_admin?: boolean } | null;
	return !!user?.is_staff || !!user?.is_admin || !!impersonating?.is_admin;
}

/**
 * Redirect if already authenticated. Use in login/signup pages.
 */
export function redirectIfAuthenticated(event: RequestEvent, to = '/') {
	if (event.locals.user) {
		redirect(302, to);
	}
}
