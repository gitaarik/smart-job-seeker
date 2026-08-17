/**
 * Deterministic metadata for a side project's linked GitHub repository.
 *
 * Read-only and side-effect free: it returns *proposals*, and the editor
 * decides what to apply through the normal PATCH. Keeping the write out of here
 * is what lets the UI pre-select only the fields that are currently empty
 * without this endpoint needing to know anything about the form's live state.
 *
 * Tier 1 of `planning/SEMANTIC-MATCHING-AND-RAG.md` § Repo-derived project
 * evidence. No LLM, so no credits — the scarce resource is GitHub's rate limit,
 * which `SJS_GITHUB_TOKEN` widens.
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { side_projects } from '$lib/server/db/schema';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { requireRowActor } from '$lib/server/profile/write-http';
import {
	fetchRepoMetadata,
	GitHubFetchError,
	parseGitHubRepoUrl,
	proposalsFor
} from '$lib/server/github/repo-metadata';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const projectId = parseIntParam(params.id, 'project');

	// Ownership first: a row that isn't yours and a row that doesn't exist give
	// the same 403, so this must run before anything reads the row.
	await requireRowActor('side_project', projectId, user.id);

	// The editor autosaves, but a user who pastes a URL and immediately clicks
	// fetch would otherwise race the 700ms debounce. An explicit URL in the body
	// wins; the stored one is the fallback.
	const body = (await request.json().catch(() => ({}))) as { repo_url?: unknown };
	let repoUrl = typeof body.repo_url === 'string' ? body.repo_url.trim() : '';
	if (!repoUrl) {
		const row = await db.query.side_projects.findFirst({
			where: eq(side_projects.id, projectId),
			columns: { repo_url: true }
		});
		repoUrl = row?.repo_url?.trim() ?? '';
	}
	if (!repoUrl) error(400, 'This project has no repository URL yet.');

	const ref = parseGitHubRepoUrl(repoUrl);
	if (!ref) error(400, 'Not a GitHub repository URL. Only GitHub is supported for now.');

	try {
		const meta = await fetchRepoMetadata(ref, AbortSignal.timeout(10_000));
		return json({
			repo: { owner: meta.owner, repo: meta.repo, url: meta.htmlUrl, archived: meta.archived },
			proposals: proposalsFor(meta)
		});
	} catch (err) {
		// GitHubFetchError already carries a client-appropriate status and message.
		if (err instanceof GitHubFetchError) error(err.status, err.message);
		throw err;
	}
};
