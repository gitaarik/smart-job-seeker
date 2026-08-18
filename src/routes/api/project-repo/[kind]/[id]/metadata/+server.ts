/**
 * Deterministic metadata for a project's linked GitHub repository.
 *
 * Read-only and side-effect free: it returns *proposals*, and the editor
 * decides what to apply through the normal PATCH. Keeping the write out of here
 * is what lets the UI pre-select only the fields that are currently empty
 * without this endpoint needing to know anything about the form's live state.
 *
 * Tier 1/1b of `planning/SEMANTIC-MATCHING-AND-RAG.md` § Repo-derived project
 * evidence. No LLM, so no credits — the scarce resource is GitHub's rate limit,
 * which `SJS_GITHUB_TOKEN` widens.
 *
 * Serves both project kinds. `mapProposalField` absorbs the fact that a
 * work-experience project calls its summary `description` and has no `stars`.
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { requireRowActor } from '$lib/server/profile/write-http';
import {
	loadProjectContext,
	mapProposal,
	parseProjectKind
} from '$lib/server/documents/project-corpus';
import {
	fetchRepoLanguages,
	fetchRepoMetadata,
	GitHubFetchError,
	parseGitHubRepoUrl,
	proposalsFor,
	technologyProposalsFor
} from '$lib/server/github/repo-metadata';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const kind = parseProjectKind(params.kind);
	if (!kind) error(400, 'Unknown project type');
	const projectId = parseIntParam(params.id, 'project');

	// Ownership first: a row that isn't yours and a row that doesn't exist give
	// the same 403, so this must run before anything reads the row.
	await requireRowActor(kind, projectId, user.id);

	const project = await loadProjectContext(kind, projectId);
	if (!project) error(404, 'Project not found');

	// The editor autosaves, but a user who pastes a URL and immediately clicks
	// fetch would otherwise race the 700ms debounce. An explicit URL in the body
	// wins; the stored one is the fallback.
	const body = (await request.json().catch(() => ({}))) as { repo_url?: unknown };
	const repoUrl =
		(typeof body.repo_url === 'string' ? body.repo_url.trim() : '') || project.repoUrl;
	if (!repoUrl) error(400, 'This project has no repository URL yet.');

	const ref = parseGitHubRepoUrl(repoUrl);
	if (!ref) error(400, 'Not a GitHub repository URL. Only GitHub is supported for now.');

	try {
		const signal = AbortSignal.timeout(10_000);
		// Two calls, one round trip: the repo payload has no per-language breakdown
		// and `/languages` has nothing else. Both share the rate-limit budget, so
		// they go together rather than on separate button presses.
		const [meta, languages] = await Promise.all([
			fetchRepoMetadata(ref, signal),
			fetchRepoLanguages(ref, signal)
		]);
		const proposals = proposalsFor(meta).flatMap((proposal) => {
			const mapped = mapProposal(kind, proposal);
			return mapped ? [mapped] : [];
		});
		return json({
			repo: { owner: meta.owner, repo: meta.repo, url: meta.htmlUrl, archived: meta.archived },
			proposals,
			technologies: technologyProposalsFor(meta, languages)
		});
	} catch (err) {
		// GitHubFetchError already carries a client-appropriate status and message.
		if (err instanceof GitHubFetchError) error(err.status, err.message);
		throw err;
	}
};
