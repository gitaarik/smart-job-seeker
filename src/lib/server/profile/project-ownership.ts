/**
 * Does this project belong to this profile?
 *
 * Asked by everything that attaches something to a project — a document, a
 * repository scan, a story — because the project id always arrives from the
 * client. A side project carries its profile directly; a role project reaches
 * it through the role, which is the whole difference between the two queries
 * and the reason this is worth writing once.
 */

import { and, eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { side_projects, work_experience_projects } from '$lib/server/db/schema';
import type { ProjectKind } from '$lib/server/documents/project-corpus';

export async function projectBelongsToProfile(
	kind: ProjectKind,
	projectId: number,
	profileId: number
): Promise<boolean> {
	if (kind === 'side_project') {
		const row = await db.query.side_projects.findFirst({
			where: and(eq(side_projects.id, projectId), eq(side_projects.profile_id, profileId)),
			columns: { id: true }
		});
		return !!row;
	}

	const row = await db.query.work_experience_projects.findFirst({
		where: eq(work_experience_projects.id, projectId),
		columns: { id: true },
		with: { work_experience: { columns: { profile_id: true } } }
	});
	return row?.work_experience?.profile_id === profileId;
}
