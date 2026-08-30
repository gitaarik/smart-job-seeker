/**
 * One side project, for its header and both of its tabs.
 *
 * In the layout rather than the page because the tab bar and the title are the
 * layout's, and the Details tab needs nothing this does not already fetch. Its
 * attachments load in the tab that renders them.
 */

import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { projectDetailDep } from '$lib/project-detail';
import { dbDirect as db } from '$lib/server/db';
import { and, asc, count, eq } from 'drizzle-orm';
import {
	profile_document_projects,
	side_project_achievements,
	side_project_technologies,
	side_projects
} from '$lib/server/db/schema';

export const load: LayoutServerLoad = async ({ params, parent, depends }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		redirect(302, '/profile/side-projects');
	}

	// Nothing this load reads changes as the user moves between the tabs, so
	// SvelteKit rightly keeps its result — and the Details tab, which has no load
	// of its own, would be rebuilt from a row that predates its own saves. The
	// tab invalidates this after each write. See `projectDetailDep`.
	depends(projectDetailDep('side_project', id));

	const project = await db.query.side_projects.findFirst({
		where: and(
			eq(side_projects.id, id),
			eq(side_projects.profile_id, layoutData.selectedProfile.id)
		),
		with: {
			side_project_achievements: {
				orderBy: asc(side_project_achievements.sort)
			},
			side_project_technologies: {
				orderBy: asc(side_project_technologies.sort)
			}
		}
	});

	if (!project) {
		redirect(302, '/profile/side-projects');
	}

	// How much is on the Files & code tab — for its label, and for the Details
	// tab's pointer to it. A count, not the list: the list loads in the tab
	// that renders it.
	const [{ sourceCount }] = await db
		.select({ sourceCount: count() })
		.from(profile_document_projects)
		.where(eq(profile_document_projects.side_project_id, project.id));

	// Get image URL
	const imageUrl = project?.image_path ? `/uploads/${project.image_path}` : null;

	// Get banner URL
	const bannerUrl = project?.banner_path ? `/uploads/${project.banner_path}` : null;

	return {
		project,
		profileId: layoutData.selectedProfile.id,
		sourceCount,
		imageUrl,
		bannerUrl
	};
};
