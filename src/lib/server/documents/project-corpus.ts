/**
 * One project of either kind, plus whatever code has been ingested for it.
 *
 * Side projects and work-experience projects are separate tables with different
 * column names for the same ideas, and the suggestion feature does not care
 * which it is looking at. This is where that difference is absorbed, once,
 * rather than in each route.
 *
 * The asymmetry worth knowing: a side project holds a `summary` and a list of
 * achievement rows; a work-experience project holds a `description` and a
 * single `outcome` field whose placeholder is literally "What changed because
 * of it?". They map onto each other cleanly, and `outcome` turns out to be the
 * exact target for an answered question.
 */

import { asc, desc, eq, inArray } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import {
	profile_document_files,
	profile_document_projects,
	side_projects,
	work_experience_projects
} from '$lib/server/db/schema';
import type { ProjectContext } from '$lib/server/github/project-proposals';

export type ProjectKind = 'side_project' | 'work_experience_project';

export function parseProjectKind(value: string): ProjectKind | null {
	return value === 'side_project' || value === 'work_experience_project' ? value : null;
}

export interface LoadedProjectContext extends ProjectContext {
	profileId: number;
	/** Both kinds carry one now; a role project's is usually empty. */
	repoUrl: string;
}

/**
 * Re-aim one metadata proposal at this kind's own column, or drop it when the
 * kind has no equivalent.
 *
 * The GitHub metadata fetch speaks in side-project field names because that is
 * where it was built. A work-experience project stores the same idea under
 * `description`, and has no `stars` column at all — deliberately, since a star
 * count is a side-project vanity metric and a role project's entry is about the
 * work. Mapping here keeps that knowledge out of the fetcher and the UI.
 *
 * The label moves with the field: a checkbox reading "Summary" above a box
 * headed "Description" is a small lie about where the value is going.
 */
export function mapProposal<T extends { field: string; label: string }>(
	kind: ProjectKind,
	proposal: T
): T | null {
	if (kind === 'side_project') return proposal;
	if (proposal.field === 'stars') return null;
	if (proposal.field === 'summary') {
		return { ...proposal, field: 'description', label: 'Description' };
	}
	return proposal;
}

/** The project as the proposal prompt needs to see it, or null if it is gone. */
export async function loadProjectContext(
	kind: ProjectKind,
	id: number
): Promise<LoadedProjectContext | null> {
	if (kind === 'side_project') {
		const row = await db.query.side_projects.findFirst({
			where: eq(side_projects.id, id),
			columns: { id: true, profile_id: true, name: true, summary: true, repo_url: true },
			with: {
				side_project_technologies: { columns: { name: true } },
				side_project_achievements: { columns: { description: true } }
			}
		});
		if (!row) return null;
		return {
			profileId: row.profile_id,
			name: row.name ?? '',
			summary: row.summary ?? '',
			technologies: row.side_project_technologies.map((t) => t.name ?? '').filter(Boolean),
			achievements: row.side_project_achievements.map((a) => a.description ?? '').filter(Boolean),
			repoUrl: row.repo_url?.trim() ?? ''
		};
	}

	const row = await db.query.work_experience_projects.findFirst({
		where: eq(work_experience_projects.id, id),
		columns: { id: true, name: true, description: true, outcome: true, repo_url: true },
		with: {
			work_experience: { columns: { profile_id: true } },
			work_experience_project_technologies: { columns: { name: true } }
		}
	});
	if (!row?.work_experience) return null;
	return {
		profileId: row.work_experience.profile_id,
		name: row.name ?? '',
		// `description` is this table's summary; `outcome` is its one achievement.
		summary: row.description ?? '',
		technologies: row.work_experience_project_technologies.map((t) => t.name ?? '').filter(Boolean),
		achievements: row.outcome?.trim() ? [row.outcome.trim()] : [],
		repoUrl: row.repo_url?.trim() ?? ''
	};
}

export interface ProjectCorpus {
	scan: { id: number; title: string | null; sourceCount: number };
	files: { path: string; text: string }[];
}

/**
 * Everything ingested for a project, as one corpus.
 *
 * **All** of its attachments, not the newest one. An earlier version of this
 * took only the latest, reasoning that an older ingest is a stale view of the
 * code — true for a *repeat scan of the same repository*, and wrong for
 * everything else. Someone who uploads a task document and the acceptance email
 * that followed it has described one project in two files, and reading only the
 * newer one produced a summary of the email.
 *
 * Repeat scans are still collapsed: repository attachments are deduped by
 * owner/repo, newest kept, so re-scanning after a commit does not feed the
 * model two versions of the same tree. `buildDocumentBlob` caps the total, so a
 * project with many attachments trims rather than explodes.
 */
export async function loadProjectCorpus(
	kind: ProjectKind,
	id: number
): Promise<ProjectCorpus | null> {
	const scoped =
		kind === 'side_project'
			? eq(profile_document_projects.side_project_id, id)
			: eq(profile_document_projects.work_experience_project_id, id);

	const attachments = await db.query.profile_document_projects.findMany({
		where: scoped,
		orderBy: [desc(profile_document_projects.date_created)],
		columns: { id: true, title: true, kind: true, source: true }
	});
	if (attachments.length === 0) return null;

	const seenRepos = new Set<string>();
	const useful = attachments.filter((row) => {
		if (row.kind !== 'github_repo') return true;
		const source = row.source as { owner?: string; repo?: string } | null;
		const key = `${source?.owner ?? ''}/${source?.repo ?? ''}`;
		if (seenRepos.has(key)) return false;
		seenRepos.add(key);
		return true;
	});

	const files = await db.query.profile_document_files.findMany({
		where: inArray(
			profile_document_files.project_id,
			useful.map((a) => a.id)
		),
		orderBy: [asc(profile_document_files.project_id), asc(profile_document_files.sort)],
		columns: { path: true, extracted_text: true }
	});

	return {
		// The newest attachment names the corpus in the UI; the rest are counted.
		scan: { id: useful[0].id, title: useful[0].title, sourceCount: useful.length },
		files: files.map((f) => ({ path: f.path ?? '', text: f.extracted_text ?? '' }))
	};
}
