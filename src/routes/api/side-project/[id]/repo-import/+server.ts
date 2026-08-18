/**
 * Scan a side project's linked GitHub repository into its document corpus.
 *
 * Tier 2 of `planning/SEMANTIC-MATCHING-AND-RAG.md` § Repo-derived project
 * evidence: the repository becomes one more *attachment* on the project, so the
 * retriever, cover letters, application answers and match scoring pick it up
 * with no changes of their own. A zipball is a ZIP, so the extractor needs no
 * special case — only the provenance does.
 *
 * Unlike the metadata fetch next door this one writes, costs credits and eats
 * storage quota, so it reuses the upload route's guards rather than inventing
 * its own.
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { and, eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { profile_document_projects, side_projects } from '$lib/server/db/schema';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { requireRowActor } from '$lib/server/profile/write-http';
import { requireCredits } from '$lib/server/billing/require-credits';
import { requireDocumentQuota } from '$lib/server/billing/require-document-quota';
import { DocumentExtractError, extractUpload } from '$lib/server/documents/extract';
import { saveExtractedProject, setProjectSummary } from '$lib/server/documents/store';
import { summarizeProject } from '$lib/server/documents/summarize';
import {
	fetchRepoArchive,
	fetchRepoHeadSha,
	fetchRepoMetadata,
	GitHubFetchError,
	parseGitHubRepoUrl
} from '$lib/server/github/repo-metadata';

/** Has this exact commit already been scanned into this project? */
async function existingScan(sideProjectId: number, sha: string) {
	const rows = await db.query.profile_document_projects.findMany({
		where: and(
			eq(profile_document_projects.side_project_id, sideProjectId),
			eq(profile_document_projects.kind, 'github_repo')
		),
		columns: { id: true, title: true, source: true }
	});
	return rows.find((row) => (row.source as { sha?: string } | null)?.sha === sha) ?? null;
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const projectId = parseIntParam(params.id, 'project');
	await requireRowActor('side_project', projectId, user.id);

	const project = await db.query.side_projects.findFirst({
		where: eq(side_projects.id, projectId),
		columns: { id: true, profile_id: true, name: true, repo_url: true }
	});
	if (!project) error(404, 'Project not found');

	const body = (await request.json().catch(() => ({}))) as { repo_url?: unknown };
	const repoUrl =
		(typeof body.repo_url === 'string' ? body.repo_url.trim() : '') ||
		project.repo_url?.trim() ||
		'';
	if (!repoUrl) error(400, 'This project has no repository URL yet.');

	const ref = parseGitHubRepoUrl(repoUrl);
	if (!ref) error(400, 'Not a GitHub repository URL. Only GitHub is supported for now.');

	// Affordability floor for the summarization LLM call; the real per-token
	// charge happens inside summarizeProject. Checked before the download so a
	// broke account does not pull 100MB first.
	await requireCredits(user.id, 3);

	try {
		const signal = AbortSignal.timeout(120_000);
		const meta = await fetchRepoMetadata(ref, signal);
		const sha = await fetchRepoHeadSha(ref, meta.defaultBranch, signal);

		// Re-scanning an unmoved HEAD would spend a download, an extraction and a
		// summarization to arrive at a byte-identical corpus.
		const already = await existingScan(projectId, sha);
		if (already) {
			return json({
				success: true,
				unchanged: true,
				document: { id: already.id, title: already.title },
				sha
			});
		}

		const bytes = await fetchRepoArchive(ref, sha, signal);
		const filename = `${ref.owner}-${ref.repo}-${sha.slice(0, 7)}.zip`;
		const extracted = await extractUpload({ filename, bytes });

		await requireDocumentQuota(user.id, extracted.totalBytes, 1);

		const saved = await saveExtractedProject(
			{
				profileId: project.profile_id,
				filename,
				title: `${ref.owner}/${ref.repo} @ ${sha.slice(0, 7)}`,
				sideProjectId: projectId,
				kind: 'github_repo',
				source: {
					type: 'github_repo',
					owner: ref.owner,
					repo: ref.repo,
					ref: meta.defaultBranch,
					sha,
					visibility: 'public',
					url: meta.htmlUrl
				}
			},
			extracted
		);

		// Best-effort, exactly as for an upload: the scan still counts if the LLM
		// step fails, and the summary can be filled later by a reparse.
		let summary: string | null = null;
		let keywords: string[] | null = null;
		const result = await summarizeProject(project.profile_id, extracted.files).catch(() => null);
		if (result) {
			await setProjectSummary(saved.id, result.summary, result.keywords);
			summary = result.summary || null;
			keywords = result.keywords.length > 0 ? result.keywords : null;
		}

		return json({
			success: true,
			unchanged: false,
			document: { ...saved, summary, keywords },
			sha
		});
	} catch (err) {
		if (err instanceof GitHubFetchError) error(err.status, err.message);
		if (err instanceof DocumentExtractError) error(400, err.message);
		throw err;
	}
};
