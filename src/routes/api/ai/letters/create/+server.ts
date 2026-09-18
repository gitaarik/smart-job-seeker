import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { applications, application_letters } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);

	const body = await request.json();
	// `title` is optional and names the letter where its type does not tell it
	// apart from another on the same application. Absent for the first one of a
	// type, which the list is happy to call by the type alone.
	const { applicationId, letterType, title } = body;

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
			title: typeof title === 'string' && title.trim() ? title.trim() : null,
			status: 'draft',
			date_created: new Date()
		})
		.returning();

	return json({ success: true, letterId: newLetter.id });
};
