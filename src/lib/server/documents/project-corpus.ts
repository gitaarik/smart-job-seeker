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

import { and, asc, desc, eq } from 'drizzle-orm';
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
}

/** The project as the proposal prompt needs to see it, or null if it is gone. */
export async function loadProjectContext(
	kind: ProjectKind,
	id: number
): Promise<LoadedProjectContext | null> {
	if (kind === 'side_project') {
		const row = await db.query.side_projects.findFirst({
			where: eq(side_projects.id, id),
			columns: { id: true, profile_id: true, name: true, summary: true },
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
			achievements: row.side_project_achievements.map((a) => a.description ?? '').filter(Boolean)
		};
	}

	const row = await db.query.work_experience_projects.findFirst({
		where: eq(work_experience_projects.id, id),
		columns: { id: true, name: true, description: true, outcome: true },
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
		achievements: row.outcome?.trim() ? [row.outcome.trim()] : []
	};
}

export interface ProjectCorpus {
	scan: { id: number; title: string | null };
	files: { path: string; text: string }[];
}

/**
 * The most recent ingested code for a project — a repository scan if there is
 * one, otherwise the newest upload.
 *
 * Repository scans win because they are the only source that can be re-pulled
 * on demand, so a stale upload should not shadow a fresh scan. Beyond that it
 * is newest-first: an older ingest of the same project is a stale view of the
 * code and there is nothing to be learned from asking about it.
 */
export async function loadProjectCorpus(
	kind: ProjectKind,
	id: number
): Promise<ProjectCorpus | null> {
	const scoped =
		kind === 'side_project'
			? eq(profile_document_projects.side_project_id, id)
			: eq(profile_document_projects.work_experience_project_id, id);

	const scan =
		(await db.query.profile_document_projects.findFirst({
			where: and(scoped, eq(profile_document_projects.kind, 'github_repo')),
			orderBy: [desc(profile_document_projects.date_created)],
			columns: { id: true, title: true }
		})) ??
		(await db.query.profile_document_projects.findFirst({
			where: scoped,
			orderBy: [desc(profile_document_projects.date_created)],
			columns: { id: true, title: true }
		}));
	if (!scan) return null;

	const files = await db.query.profile_document_files.findMany({
		where: eq(profile_document_files.project_id, scan.id),
		orderBy: [asc(profile_document_files.sort)],
		columns: { path: true, extracted_text: true }
	});

	return {
		scan,
		files: files.map((f) => ({ path: f.path ?? '', text: f.extracted_text ?? '' }))
	};
}
