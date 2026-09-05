import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { job_platforms, search_tasks } from '$lib/server/db/schema';
import { requireAuth, parseIntParam } from '$lib/server/utils/api-helpers';
import { platformUpdateSchema, parseBody } from '$lib/server/validation/api-schemas';
import { checkPublicHttpUrl } from '$lib/server/net/public-url';
import { LOGIN_PAGE_URL_MAX } from '$lib/import-tasks/custom-site';

/**
 * PATCH /api/platforms/[id]
 *
 * Update platform fields (e.g. login_page_url).
 *
 * Staff can always edit. A normal user can edit only a platform they added
 * themselves (`created_by_user_id`), and only while no other account has a
 * task on it.
 *
 * The rule used to be looser — "no other account uses it" alone, inferred
 * from tasks because the owner column did not exist yet — and that was a hole
 * with a specific shape. `job_platforms` is global, and `login_page_url` is
 * where the scraper types a user's stored username and password in "auto"
 * mode. Under the old rule the first user to touch a curated platform that
 * nobody else had a task on yet (Glassdoor on a fresh instance, say) could
 * point its sign-in page at any public URL, and every account that later
 * created a task there with saved credentials would have them filled into
 * that page. Ownership closes it: the curated rows have no owner and so are
 * admin-only, and a custom site stays editable by whoever pasted it.
 *
 * `canEditSignInPage` in the task page's load mirrors this exactly, so the
 * field never renders and then 403s on save.
 *
 * The two URL checks below duplicate what the create action does to the same
 * column, and for the same reasons: the URL becomes a navigation target for a
 * real browser (see `public-url.ts`), and `job_platforms.login_page_url` is
 * `varchar(255)`, so an over-long one is a refusal rather than a 500 on write.
 * Both were absent while this endpoint had no caller in the UI; the sign-in
 * section on the task page is the first, so they matter now.
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const user = requireAuth(locals);
	const platformId = parseIntParam(params.id, 'platform');

	const platform = await db.query.job_platforms.findFirst({
		where: eq(job_platforms.id, platformId)
	});
	if (!platform) {
		throw error(404, 'Platform not found');
	}

	// Authorization: staff can always edit
	const isStaff =
		(user as { is_staff?: boolean }).is_staff || (user as { is_admin?: boolean }).is_admin || false;

	if (!isStaff) {
		// Own the row first. The curated platforms have no owner, so this is
		// what keeps LinkedIn's sign-in page out of reach of whoever happens to
		// be its only user on a small instance.
		if (!platform.created_by_user_id || platform.created_by_user_id !== user.id) {
			throw error(403, 'Only the account that added this site can change its sign-in page');
		}

		// Even an owned row is shared once an admin promotes it to published
		// and other accounts start tasks on it. Their runs would follow the
		// change too, so at that point it becomes an admin edit.
		const tasksForPlatform = await db.query.search_tasks.findMany({
			where: eq(search_tasks.platform_id, platformId),
			columns: { id: true },
			with: { profile: { columns: { user_id: true } } }
		});
		const otherUserUsage = tasksForPlatform.find(
			(t) => t.profile?.user_id && t.profile.user_id !== user.id
		);
		if (otherUserUsage) {
			throw error(403, 'Cannot edit platform URLs used by other accounts');
		}
	}

	const data = parseBody(platformUpdateSchema, await request.json());

	if (data.login_page_url) {
		if (data.login_page_url.length > LOGIN_PAGE_URL_MAX) {
			throw error(
				400,
				`That sign-in page URL is too long (over ${LOGIN_PAGE_URL_MAX} characters).`
			);
		}
		const verdict = checkPublicHttpUrl(data.login_page_url);
		if (!verdict.ok) {
			throw error(400, `That sign-in page URL can't be used: ${verdict.reason}`);
		}
	}

	await db
		.update(job_platforms)
		.set({ ...data, date_updated: new Date() })
		.where(eq(job_platforms.id, platformId));

	return json({ ok: true });
};
