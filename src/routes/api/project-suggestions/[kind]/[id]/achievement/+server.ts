/**
 * One answered question → one CV achievement line.
 *
 * The other half of the questions this feature asks. `POST ../` may not assert
 * impact because it has only the code; this may, because the applicant has just
 * supplied it in their own words. Everything here exists to keep that boundary
 * intact — the answer is required, and the response carries back the quote the
 * claim rests on so the applicant can see whether an outcome came from them.
 *
 * Still writes nothing: it returns a draft, and the editor applies it through
 * the same path as any typed achievement.
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { requireRowActor } from '$lib/server/profile/write-http';
import { requireCredits } from '$lib/server/billing/require-credits';
import { loadProjectContext, parseProjectKind } from '$lib/server/documents/project-corpus';
import { achievementFromAnswer } from '$lib/server/github/project-proposals';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const kind = parseProjectKind(params.kind);
	if (!kind) error(400, 'Unknown project type');
	const projectId = parseIntParam(params.id, 'project');
	await requireRowActor(kind, projectId, user.id);

	const body = (await request.json().catch(() => ({}))) as {
		question?: unknown;
		evidence?: unknown;
		answer?: unknown;
	};
	const question = typeof body.question === 'string' ? body.question.trim() : '';
	const answer = typeof body.answer === 'string' ? body.answer.trim() : '';
	const evidence = typeof body.evidence === 'string' ? body.evidence.trim() : '';
	if (!question) error(400, 'Missing the question this answers.');
	if (!answer) error(400, 'Write an answer first — the achievement comes from your words.');

	const project = await loadProjectContext(kind, projectId);
	if (!project) error(404, 'Project not found');

	await requireCredits(user.id, 2);

	const draft = await achievementFromAnswer(project.profileId, {
		projectName: project.name,
		question,
		evidence,
		answer
	});
	if (!draft) error(502, 'The model did not return a usable achievement. Try again.');

	return json(draft);
};
