import type { Actions, PageServerLoad } from './$types';
import { sectionActions } from '../section-actions';
import { PROFILE_RESOURCES } from '$lib/server/profile/resources';
import { redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq, asc } from 'drizzle-orm';
import {
	side_projects,
	side_project_achievements,
	side_project_technologies
} from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ parent }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}

	const projects = await db.query.side_projects.findMany({
		where: eq(side_projects.profile_id, layoutData.selectedProfile.id),
		// The list order is declared with the section itself, so the page and
		// the write layer's append placement cannot disagree about it.
		orderBy: PROFILE_RESOURCES.side_project.orderBy,
		with: {
			side_project_achievements: {
				orderBy: asc(side_project_achievements.sort)
			},
			side_project_technologies: {
				orderBy: asc(side_project_technologies.sort)
			}
		}
	});

	const ordering: 'date' | 'manual' = projects.some((p) => p.sort !== null) ? 'manual' : 'date';

	return { projects, ordering, profileId: layoutData.selectedProfile.id };
};

export const actions: Actions = sectionActions('side_project', {
	createdPath: (id) => `/profile/side-projects/${id}`,
	include: ['create', 'reorder', 'resetOrder', 'delete']
});
