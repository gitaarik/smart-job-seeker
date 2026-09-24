/**
 * The plan's profile limit, as a form-action refusal.
 *
 * `requireProfileQuota` throws a 403 like the other billing guards, which is
 * right for an API endpoint and wrong for a form action: a thrown error
 * replaces the page with the error page, while every creation form here
 * already renders `form.error` next to the field. So the actions call this and
 * return what it gives them.
 *
 * Checked in the route rather than inside `createProfileFromResume` /
 * `importProfileFromJson` / `importExportData`, because those also create the
 * demo clone and the seed scripts' profiles, which are not a user spending
 * their plan.
 */
import { fail, isHttpError, type ActionFailure } from '@sveltejs/kit';
import { requireProfileQuota } from '$lib/server/billing/require-profile-quota';

export async function profileQuotaFailure(
	userId: string
): Promise<ActionFailure<{ error: string }> | null> {
	try {
		await requireProfileQuota(userId, 1);
		return null;
	} catch (e) {
		if (isHttpError(e)) return fail(e.status, { error: e.body.message });
		throw e;
	}
}
