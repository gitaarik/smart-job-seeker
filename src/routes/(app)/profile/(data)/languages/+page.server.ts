import type { Actions, PageServerLoad } from './$types';
import { sectionActions } from '../section-actions';
import { PROFILE_RESOURCES } from '$lib/server/profile/resources';
import { redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { languages } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ parent }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}

	const items = await db.query.languages.findMany({
		where: eq(languages.profile_id, layoutData.selectedProfile.id),
		// The list order is declared with the section itself, so the page and
		// the write layer's append placement cannot disagree about it.
		orderBy: PROFILE_RESOURCES.language.orderBy
	});

	return { languages: items, profileId: layoutData.selectedProfile.id };
};

export const actions: Actions = sectionActions('language', {
	include: ['create', 'update', 'delete']
});
