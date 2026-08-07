import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq, and, desc, asc } from 'drizzle-orm';
import { education } from '$lib/server/db/schema';
import { getSelectedProfileId, touchProfile } from '../../utils';

export const load: PageServerLoad = async ({ parent }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}

	const items = await db.query.education.findMany({
		where: eq(education.profile_id, layoutData.selectedProfile.id),
		orderBy: [asc(education.sort), desc(education.start_date)]
	});

	return { education: items, profileId: layoutData.selectedProfile.id };
};

export const actions: Actions = {
	create: async ({ request, locals, cookies }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const formData = await request.formData();
		const institution = formData.get('institution') as string;
		const area = formData.get('area') as string;
		const study_type = formData.get('study_type') as string;
		const location = formData.get('location') as string;
		const url = formData.get('url') as string;
		const graduation_year = formData.get('graduation_year') as string;
		const start_date = formData.get('start_date') as string;
		const end_date = formData.get('end_date') as string;
		const summary = formData.get('summary') as string;

		if (!institution || institution.trim().length === 0)
			return fail(400, { error: 'Institution is required' });

		const lastItem = await db.query.education.findFirst({
			where: eq(education.profile_id, profileId),
			orderBy: desc(education.sort)
		});

		const [created] = await db
			.insert(education)
			.values({
				institution: institution.trim(),
				area: area?.trim() || null,
				study_type: study_type?.trim() || null,
				location: location?.trim() || null,
				url: url?.trim() || null,
				graduation_year: graduation_year ? parseInt(graduation_year) : null,
				start_date: start_date || null,
				end_date: end_date || null,
				summary: summary?.trim() || null,
				profile_id: profileId,
				sort: (lastItem?.sort ?? -1) + 1,
				status: 'published',
				date_created: new Date()
			})
			.returning();

		await touchProfile(profileId);
		redirect(302, `/profile/education/${created.id}`);
	},

	delete: async ({ request, locals, cookies }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		if (isNaN(id)) return fail(400, { error: 'Invalid education ID' });

		const existing = await db.query.education.findFirst({
			where: and(eq(education.id, id), eq(education.profile_id, profileId))
		});
		if (!existing) return fail(404, { error: 'Education entry not found' });

		await db.delete(education).where(eq(education.id, id));

		await touchProfile(profileId);
		return { success: true };
	}
};
