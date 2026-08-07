import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { scraper_agent_sessions } from '$lib/server/db/schema';
import { requireAuth, parseIntParam } from '$lib/server/utils/api-helpers';

export const POST: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	if (!(user as { is_admin?: boolean }).is_admin) {
		throw error(403, 'Admin access required');
	}

	const sessionId = parseIntParam(params.id, 'session');

	const session = await db.query.scraper_agent_sessions.findFirst({
		where: eq(scraper_agent_sessions.id, sessionId)
	});

	if (!session) throw error(404, 'Session not found');
	if (session.status !== 'active') {
		throw error(400, `Cannot pause session with status "${session.status}"`);
	}

	await db
		.update(scraper_agent_sessions)
		.set({
			status: 'paused',
			updated_at: new Date()
		})
		.where(eq(scraper_agent_sessions.id, sessionId));

	return json({ status: 'paused' });
};
