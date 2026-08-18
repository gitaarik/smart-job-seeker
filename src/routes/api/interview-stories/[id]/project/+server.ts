/**
 * PUT /api/interview-stories/[id]/project — set (or clear) the project a story
 * is about.
 *
 * Its own endpoint rather than a field on the story PUT, because that one
 * replaces every STAR field and a title: linking a story you have already
 * written would have to send the whole story back to change one column, and
 * whatever the client had stale would win.
 *
 * `kind: null` unlinks. Setting one kind clears the other — a story is about
 * one project or none, and two links would make "which project is this about"
 * a question with two answers.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { profiles, project_stories } from '$lib/server/db/schema';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { touchProfile } from '$lib/server/profile/touch-profile';
import { projectBelongsToProfile } from '$lib/server/profile/project-ownership';
import { interviewStoryLinkSchema, parseBody } from '$lib/server/validation/api-schemas';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const storyId = parseIntParam(params.id, 'story');

	const { profile_id, kind, project_id } = parseBody(
		interviewStoryLinkSchema,
		await request.json()
	);

	const profile = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profile_id), eq(profiles.user_id, user.id))
	});
	if (!profile) return json({ error: 'Profile not found' }, { status: 404 });

	const story = await db.query.project_stories.findFirst({
		where: and(eq(project_stories.id, storyId), eq(project_stories.profile_id, profile_id)),
		columns: { id: true }
	});
	if (!story) return json({ error: 'Story not found' }, { status: 404 });

	if (kind !== null) {
		if (project_id === null) {
			return json({ error: 'A project id is required to link a story' }, { status: 400 });
		}
		if (!(await projectBelongsToProfile(kind, project_id, profile_id))) {
			return json({ error: 'Project not found on this profile' }, { status: 400 });
		}
	}

	await db
		.update(project_stories)
		.set({
			work_experience_project_id: kind === 'work_experience_project' ? project_id : null,
			side_project_id: kind === 'side_project' ? project_id : null,
			date_updated: new Date()
		})
		.where(eq(project_stories.id, storyId));

	await touchProfile(profile_id);
	return json({ success: true });
};
