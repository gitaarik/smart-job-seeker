import type { PageServerLoad } from './$types';
import { projectStories } from '$lib/server/profile/project-stories';

export const load: PageServerLoad = async ({ parent }) => {
	// `parent()` for the project, not `params` — the layout's ownership check has
	// to be awaited to be a check; see the sources tab.
	const { project, profileId } = await parent();
	return projectStories('work_experience_project', project.id, profileId);
};
