import type { Actions, PageServerLoad } from './$types';
import { sectionActions } from '../section-actions';
import { PROFILE_RESOURCES } from '$lib/server/profile/resources';
import { redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq, asc } from 'drizzle-orm';
import {
	work_experiences,
	work_experience_achievements,
	work_experience_technologies
} from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ parent }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}

	const experiences = await db.query.work_experiences.findMany({
		where: eq(work_experiences.profile_id, layoutData.selectedProfile.id),
		// The list order is declared with the section itself, so the page and
		// the write layer's append placement cannot disagree about it.
		orderBy: PROFILE_RESOURCES.work_experience.orderBy,
		with: {
			work_experience_achievements: {
				orderBy: asc(work_experience_achievements.sort)
			},
			work_experience_technologies: {
				orderBy: asc(work_experience_technologies.sort)
			}
		}
	});

	const ordering: 'date' | 'manual' = experiences.some((e) => e.sort !== null) ? 'manual' : 'date';

	return { experiences, ordering, profileId: layoutData.selectedProfile.id };
};

export const actions: Actions = sectionActions('work_experience', {
	createdPath: (id) => `/profile/work-experience/${id}`,
	include: ['create', 'reorder', 'resetOrder', 'delete']
});
