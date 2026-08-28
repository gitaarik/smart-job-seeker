import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { and, asc, eq } from 'drizzle-orm';
import { getResumeTemplatesForProfile } from '$lib/server/profile/resume-templates';
import { listTemplateOverridesFor } from '$lib/server/profile/template-overrides';
import {
	work_experience_achievements,
	work_experience_project_technologies,
	work_experience_projects,
	work_experience_technologies,
	work_experiences
} from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ params, parent }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		redirect(302, '/profile/work-experience');
	}

	const experience = await db.query.work_experiences.findFirst({
		where: and(
			eq(work_experiences.id, id),
			eq(work_experiences.profile_id, layoutData.selectedProfile.id)
		),
		with: {
			work_experience_achievements: {
				orderBy: asc(work_experience_achievements.sort)
			},
			work_experience_technologies: {
				orderBy: asc(work_experience_technologies.sort)
			},
			work_experience_projects: {
				orderBy: asc(work_experience_projects.sort),
				with: {
					work_experience_project_technologies: {
						orderBy: asc(work_experience_project_technologies.sort)
					},
					// Ids only: the list shows how many sources a project has, and the
					// project's own page loads them when it needs to render them.
					profile_document_projects: { columns: { id: true } }
				}
			}
		}
	});

	// Get logo URL (prefer local path, fall back to file UUID)
	const logoUrl = experience?.logo_path
		? `/uploads/${experience.logo_path}`
		: experience?.logo_id
			? `/assets/${experience.logo_id}`
			: null;

	// Get banner URL
	const bannerUrl = experience?.banner_path ? `/uploads/${experience.banner_path}` : null;

	if (!experience) {
		redirect(302, '/profile/work-experience');
	}

	// What this profile's templates call this role, if anything — the editor puts
	// the control under the field it overrides, so it needs both here.
	const [templates, templateOverrides] = await Promise.all([
		getResumeTemplatesForProfile(layoutData.selectedProfile.id),
		listTemplateOverridesFor(layoutData.selectedProfile.id, 'work_experience', id)
	]);

	return {
		experience,
		logoUrl,
		bannerUrl,
		profileId: layoutData.selectedProfile.id,
		templates: templates.map((t) => ({ id: t.id, name: t.name })),
		templateOverrides
	};
};
