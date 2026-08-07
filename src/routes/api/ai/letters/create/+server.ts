import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { applications, application_letters } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);

	const body = await request.json();
	const { applicationId, letterType } = body;

	if (!applicationId || !letterType) {
		return json(
			{ success: false, message: 'applicationId and letterType are required' },
			{ status: 400 }
		);
	}

	// Verify ownership: application -> profile -> user
	const application = await db.query.applications.findFirst({
		where: eq(applications.id, applicationId),
		with: { profile: { columns: { user_id: true } } }
	});

	if (!application || application.profile.user_id !== user.id) {
		return json({ success: false, message: 'Application not found' }, { status: 404 });
	}

	const [newLetter] = await db
		.insert(application_letters)
		.values({
			application_id: applicationId,
			letter_type: letterType,
			status: 'draft',
			date_created: new Date()
		})
		.returning();

	return json({ success: true, letterId: newLetter.id });
};
