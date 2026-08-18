/**
 * What has been attached to this project — loaded here rather than in the
 * layout, so the Details tab does not pay for a list it never renders.
 *
 * `parent()` is awaited for the project rather than read from `params`, and
 * that is the ownership check, not a convenience: SvelteKit runs layout and
 * page loads concurrently, so a page load that trusted the id in the URL would
 * be querying while the layout was still deciding whether this project is the
 * caller's. Awaiting the parent makes the layout's redirect happen first, and
 * takes the id from a row that has already been matched to the selected profile.
 */

import type { PageServerLoad } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { asc, desc, eq } from 'drizzle-orm';
import { profile_document_projects } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ parent }) => {
	const { project } = await parent();

	const documents = await db.query.profile_document_projects.findMany({
		where: eq(profile_document_projects.work_experience_project_id, project.id),
		orderBy: [asc(profile_document_projects.sort), desc(profile_document_projects.date_created)],
		columns: {
			id: true,
			kind: true,
			title: true,
			original_filename: true,
			status: true,
			summary: true,
			keywords: true,
			skipped: true,
			file_count: true,
			total_bytes: true
		}
	});

	return { documents };
};
