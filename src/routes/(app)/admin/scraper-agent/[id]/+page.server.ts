import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { scraper_agent_sessions } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ params }) => {
	const sessionId = parseInt(params.id);
	if (isNaN(sessionId)) throw error(400, 'Invalid session ID');

	const session = await db.query.scraper_agent_sessions.findFirst({
		where: eq(scraper_agent_sessions.id, sessionId),
		columns: { id: true }
	});

	if (!session) throw error(404, 'Session not found');

	return { sessionId: session.id };
};
