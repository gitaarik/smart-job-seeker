/**
 * What a project's ingested code suggests for its CV entry.
 *
 * Works for a side project or a work-experience project — the corpus is the
 * same either way, which is the point: a work-experience project has no
 * `repo_url` and never will for proprietary work, but it can hold an uploaded
 * archive and deserves the same reading of it.
 *
 * Reads what is already stored; never touches GitHub. Returns proposals and
 * writes nothing.
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { requireRowActor } from '$lib/server/profile/write-http';
import { requireCredits } from '$lib/server/billing/require-credits';
import {
	loadProjectContext,
	loadProjectCorpus,
	parseProjectKind
} from '$lib/server/documents/project-corpus';
import { proposeFromCode } from '$lib/server/github/project-proposals';

export const POST: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	const kind = parseProjectKind(params.kind);
	if (!kind) error(400, 'Unknown project type');
	const projectId = parseIntParam(params.id, 'project');
	await requireRowActor(kind, projectId, user.id);

	const project = await loadProjectContext(kind, projectId);
	if (!project) error(404, 'Project not found');

	const corpus = await loadProjectCorpus(kind, projectId);
	if (!corpus) {
		error(400, 'Add this project’s code first — these suggestions read what has been ingested.');
	}

	await requireCredits(user.id, 3);

	const proposals = await proposeFromCode(project.profileId, corpus.files, project);
	if (!proposals) error(502, 'The model did not return usable suggestions. Try again.');

	return json({ scan: corpus.scan, ...proposals });
};
