/**
 * One project of a role — everything both of its tabs need.
 *
 * The project used to be an accordion row inside the role's page, which loaded
 * every project's technologies and documents to render one of them. A project
 * with its own route loads its own row, and the role's page is left listing
 * names.
 *
 * Loaded in the layout rather than the page because the header and the tab bar
 * are the layout's, and the Details tab has no query of its own beyond this.
 */

import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { and, asc, eq } from 'drizzle-orm';
import {
	work_experience_project_technologies,
	work_experience_projects
} from '$lib/server/db/schema';

export const load: LayoutServerLoad = async ({ params, parent }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}

	const experienceId = parseInt(params.id);
	const projectId = parseInt(params.pid);
	if (isNaN(experienceId) || isNaN(projectId)) {
		redirect(302, '/profile/work-experience');
	}

	// The role is matched too, not just the project: a project id that belongs to
	// a different role would otherwise render under this role's header and back
	// link, with a breadcrumb that lies about where its edits are going.
	const project = await db.query.work_experience_projects.findFirst({
		where: and(
			eq(work_experience_projects.id, projectId),
			eq(work_experience_projects.work_experience_id, experienceId)
		),
		with: {
			work_experience: {
				columns: { id: true, name: true, position: true, profile_id: true }
			},
			work_experience_project_technologies: {
				orderBy: asc(work_experience_project_technologies.sort)
			}
		}
	});

	if (!project || project.work_experience?.profile_id !== layoutData.selectedProfile.id) {
		redirect(302, `/profile/work-experience/${experienceId}`);
	}

	return {
		project,
		experience: project.work_experience,
		profileId: layoutData.selectedProfile.id
	};
};
