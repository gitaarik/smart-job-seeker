/**
 * Every project of a profile, of both kinds, as something to pick from.
 *
 * The two kinds live in different tables and the role project only knows its
 * employer through its role, so a picker that offered both had to join them
 * itself — twice, on the two pages that needed one. Names only: this is what a
 * `<select>` shows, not what a page renders.
 */

import { dbDirect as db } from '$lib/server/db';
import { asc, eq } from 'drizzle-orm';
import { side_projects, work_experiences, work_experience_projects } from '$lib/server/db/schema';
import type { ProjectKind } from '$lib/server/documents/project-corpus';

export interface ProjectTarget {
	kind: ProjectKind;
	id: number;
	name: string;
	/** The employer, for a role project; null for a side project. */
	context: string | null;
	/** The role a project hangs off — its page is under the role's. */
	workExperienceId: number | null;
}

export async function projectTargetsForProfile(profileId: number): Promise<ProjectTarget[]> {
	const [sides, roles] = await Promise.all([
		db.query.side_projects.findMany({
			where: eq(side_projects.profile_id, profileId),
			columns: { id: true, name: true },
			orderBy: [asc(side_projects.sort), asc(side_projects.id)]
		}),
		db.query.work_experiences.findMany({
			where: eq(work_experiences.profile_id, profileId),
			columns: { id: true, name: true },
			orderBy: [asc(work_experiences.sort), asc(work_experiences.id)],
			with: {
				work_experience_projects: {
					columns: { id: true, name: true },
					orderBy: [asc(work_experience_projects.sort), asc(work_experience_projects.id)]
				}
			}
		})
	]);

	return [
		...sides.map((p) => ({
			kind: 'side_project' as const,
			id: p.id,
			name: p.name?.trim() || 'Untitled project',
			context: null,
			workExperienceId: null
		})),
		...roles.flatMap((role) =>
			role.work_experience_projects.map((p) => ({
				kind: 'work_experience_project' as const,
				id: p.id,
				name: p.name?.trim() || 'Untitled project',
				context: role.name,
				workExperienceId: role.id
			}))
		)
	];
}
