import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { demo_links } from '$lib/server/db/schema';
import { provisionDemoUser, resumeDemoUser } from '$lib/server/demo/provision';
import { establishDemoSession } from '$lib/server/demo/session';

/**
 * Public demo entry point. Validates the link, then on first open provisions a
 * fresh demo user (clone template + grant devices + Seeker plan) or on a later
 * open within TTL resumes the same one — auto-logs in and drops the visitor on
 * the overview page. A dead/expired link renders a friendly notice.
 */
export const load: PageServerLoad = async (event) => {
	const link = await db.query.demo_links.findFirst({
		where: eq(demo_links.token, event.params.token)
	});

	if (!link || link.status !== 'active' || link.expires_at <= new Date()) {
		return { expired: true as const };
	}

	try {
		const creds = link.demo_user_id
			? ((await resumeDemoUser(link)) ?? (await provisionDemoUser(link)))
			: await provisionDemoUser(link);
		await establishDemoSession(event, creds);
	} catch (e) {
		console.error('[demo] provisioning failed:', e);
		return { error: true as const };
	}

	redirect(303, '/home');
};
