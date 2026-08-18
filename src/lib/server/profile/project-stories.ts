/**
 * The stories about one project, and the ones that could be.
 *
 * Both project pages ask the same two questions — what is linked here, and what
 * else could be linked — so they ask them here.
 *
 * One query, split in JS, rather than two queries with complementary WHERE
 * clauses: a profile's stories are a short list (they are hand-written, one per
 * interview anecdote), and the candidates need their current project's *name*
 * anyway, which is the same join either way.
 */

import { asc, eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { project_stories } from '$lib/server/db/schema';
import type { ProjectKind } from '$lib/server/documents/project-corpus';
import type { PinnedProject } from '$lib/server/documents/retrieval';

export interface StoryListRow {
	id: number;
	title: string | null;
	category: string | null;
	/** Where a candidate is linked now, when that is some other project. */
	linkedElsewhere?: string | null;
}

export interface ProjectStories {
	stories: StoryListRow[];
	candidates: StoryListRow[];
}

export async function projectStories(
	kind: ProjectKind,
	projectId: number,
	profileId: number
): Promise<ProjectStories> {
	const rows = await db.query.project_stories.findMany({
		where: eq(project_stories.profile_id, profileId),
		orderBy: [asc(project_stories.sort), asc(project_stories.id)],
		columns: { id: true, title: true, category: true },
		with: {
			work_experience_project: { columns: { id: true, name: true } },
			side_project: { columns: { id: true, name: true } }
		}
	});

	const stories: StoryListRow[] = [];
	const candidates: StoryListRow[] = [];

	for (const row of rows) {
		const linkedHere =
			kind === 'side_project'
				? row.side_project?.id === projectId
				: row.work_experience_project?.id === projectId;

		if (linkedHere) {
			stories.push({ id: row.id, title: row.title, category: row.category });
			continue;
		}

		// A story already about another project is still offerable — moving one is a
		// legitimate correction — but the list says where it is, so linking it here
		// is a decision rather than a surprise.
		candidates.push({
			id: row.id,
			title: row.title,
			category: row.category,
			linkedElsewhere: row.work_experience_project?.name ?? row.side_project?.name ?? null
		});
	}

	return { stories, candidates };
}

/**
 * The project a story is about, in the shape the retrieval layer pins with.
 *
 * Both the initial draft and every followup turn need this, and a story is
 * about one project or none — so the "which column won" decision is made once
 * here rather than as the same nested ternary in two generators.
 */
export function pinnedProjectForStory(story: {
	work_experience_project_id?: number | null;
	side_project_id?: number | null;
}): PinnedProject | undefined {
	if (story.work_experience_project_id) {
		return { kind: 'work_experience_project', id: story.work_experience_project_id };
	}
	if (story.side_project_id) {
		return { kind: 'side_project', id: story.side_project_id };
	}
	return undefined;
}
