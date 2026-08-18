/**
 * What the scanned repository suggests for this side project's CV entry.
 *
 * Reads the corpus Tier 2 stored — it does not touch GitHub — so it is only
 * available once the project has been scanned, and it costs an LLM call rather
 * than a rate-limit slot. Returns proposals and writes nothing; the editor
 * applies what the user ticks through the paths that already exist.
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { and, asc, desc, eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import {
	profile_document_files,
	profile_document_projects,
	side_projects
} from '$lib/server/db/schema';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { requireRowActor } from '$lib/server/profile/write-http';
import { requireCredits } from '$lib/server/billing/require-credits';
import { proposeFromRepo } from '$lib/server/github/repo-proposals';

export const POST: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	const projectId = parseIntParam(params.id, 'project');
	await requireRowActor('side_project', projectId, user.id);

	const project = await db.query.side_projects.findFirst({
		where: eq(side_projects.id, projectId),
		columns: { id: true, profile_id: true, name: true, summary: true },
		with: {
			side_project_technologies: { columns: { name: true } },
			side_project_achievements: { columns: { description: true } }
		}
	});
	if (!project) error(404, 'Project not found');

	// Most recently scanned commit wins; an older scan of the same repo is a
	// stale view of the code and there is no reason to ask about it.
	const scan = await db.query.profile_document_projects.findFirst({
		where: and(
			eq(profile_document_projects.side_project_id, projectId),
			eq(profile_document_projects.kind, 'github_repo')
		),
		orderBy: [desc(profile_document_projects.date_created)],
		columns: { id: true, title: true }
	});
	if (!scan) {
		error(400, 'Scan the repository first — these suggestions read the scanned code.');
	}

	await requireCredits(user.id, 3);

	const files = await db.query.profile_document_files.findMany({
		where: eq(profile_document_files.project_id, scan.id),
		orderBy: [asc(profile_document_files.sort)],
		columns: { path: true, extracted_text: true }
	});

	const proposals = await proposeFromRepo(
		project.profile_id,
		files.map((f) => ({ path: f.path ?? '', text: f.extracted_text ?? '' })),
		{
			name: project.name ?? '',
			summary: project.summary ?? '',
			technologies: project.side_project_technologies.map((t) => t.name ?? '').filter(Boolean),
			achievements: project.side_project_achievements
				.map((a) => a.description ?? '')
				.filter(Boolean)
		}
	);

	if (!proposals) error(502, 'The model did not return usable suggestions. Try again.');
	return json({ scan: { id: scan.id, title: scan.title }, ...proposals });
};
