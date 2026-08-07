import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNotifications, markAsRead, markAllAsRead } from '$lib/server/notifications';

/**
 * GET /api/notifications — Get recent notifications
 */
export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) error(401, 'Not authenticated');

	const notifications = await getNotifications(user.id);
	return json({ notifications });
};

/**
 * POST /api/notifications — Mark read
 * Body: { action: "read", id: number } or { action: "readAll" }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) error(401, 'Not authenticated');

	const body = await request.json();

	if (body.action === 'readAll') {
		await markAllAsRead(user.id);
		return json({ success: true });
	}

	if (body.action === 'read' && typeof body.id === 'number') {
		await markAsRead(body.id, user.id);
		return json({ success: true });
	}

	error(400, 'Invalid action');
};
