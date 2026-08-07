import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { job_platforms, search_tasks } from '$lib/server/db/schema';
import { requireAuth, parseIntParam } from '$lib/server/utils/api-helpers';
import { platformUpdateSchema, parseBody } from '$lib/server/validation/api-schemas';

/**
 * PATCH /api/platforms/[id]
 *
 * Update platform fields (e.g. login_page_url).
 * Staff can always edit. Normal users can only edit if no other user's
 * accounts reference this platform.
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
		// Get all search tasks for this platform with their profile user_ids
		const tasksForPlatform = await db.query.search_tasks.findMany({
			where: eq(search_tasks.platform_id, platformId),
			columns: { id: true },
			with: { profile: { columns: { user_id: true } } }
		});

		// Check that no other user uses this platform
		const otherUserUsage = tasksForPlatform.find(
			(t) => t.profile?.user_id && t.profile.user_id !== user.id
		);
		if (otherUserUsage) {
			throw error(403, 'Cannot edit platform URLs used by other accounts');
		}

		// Also verify the current user actually uses this platform
		const ownUsage = tasksForPlatform.find((t) => t.profile?.user_id === user.id);
		if (!ownUsage) {
			throw error(403, 'Not authorized');
		}
	}

	const data = parseBody(platformUpdateSchema, await request.json());

	await db
		.update(job_platforms)
		.set({ ...data, date_updated: new Date() })
		.where(eq(job_platforms.id, platformId));

	return json({ ok: true });
};
