import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { education } from '$lib/server/db/schema';
import { requireAuth, parseIntParam, buildUpdateData } from '$lib/server/utils/api-helpers';
import { educationUpdateSchema, parseBody } from '$lib/server/validation/api-schemas';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const educationId = parseIntParam(params.id, 'education');

	// Verify ownership through profile
	const educationRecord = await db.query.education.findFirst({
		where: eq(education.id, educationId),
		columns: {
			id: true
		},
		with: {
			profile: {
				columns: { user_id: true }
			}
		}
	});

	if (!educationRecord || educationRecord.profile.user_id !== user.id) {
		error(403, 'Access denied');
	}

	const data = parseBody(educationUpdateSchema, await request.json());

	const updateData = buildUpdateData(
		data,
		[
			'institution',
			'area',
			'study_type',
			'location',
			'url',
			'graduation_year',
			'start_date',
			'end_date',
			'summary',
			'tags'
		],
		{ start_date: 'date', end_date: 'date', graduation_year: 'number' }
	);

	await db.update(education).set(updateData).where(eq(education.id, educationId));

	return json({ success: true });
};
