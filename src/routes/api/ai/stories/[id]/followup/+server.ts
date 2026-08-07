import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { profiles, project_stories } from '$lib/server/db/schema';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { followupRequestSchema, parseBody } from '$lib/server/validation/api-schemas';
import { createProfileStoryFollowup } from '$lib/server/ai-chat/profile-story-followup';
import { generateProfileStory } from '$lib/server/ai-chat/profile-story';
import { STORY_VERSIONS, trimVersionsFrom } from '$lib/server/ai-chat/entity-versions';
import { trackGeneration } from '$lib/server/ai-chat/ai-generation-status';
import { requireCredits } from '$lib/server/billing/require-credits';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const storyId = parseIntParam(params.id, 'story');

	// Verify ownership: story -> profile -> user.
	const story = await db.query.project_stories.findFirst({
		where: eq(project_stories.id, storyId),
		columns: { id: true, profile_id: true }
	});
	const profile = story
		? await db.query.profiles.findFirst({
				where: eq(profiles.id, story.profile_id),
				columns: { user_id: true }
			})
		: null;
	if (!story || profile?.user_id !== user.id) {
		return json(
			{ success: false, message: 'Story not found' },
			{
				status: 404
			}
		);
	}

	const { followupRequest, includeOriginalContext, updateContent, mode, replaceVersionId } =
		parseBody(followupRequestSchema, await request.json());

	// Editing a version's message: drop it and everything after, then restore the
	// ai_chat pointer to the last remaining version. If the trim removed the turn
	// that STARTED the thread, there's nothing left to follow up on — restart the
	// same kind of turn with the edited message as its brief instead.
	let restartMode: 'generate' | 'advice' | null = null;
	if (replaceVersionId) {
		const { existed, removedSource, last } = await trimVersionsFrom(
			STORY_VERSIONS,
			storyId,
			replaceVersionId
		);
		if (!existed) {
			return json(
				{ success: false, message: 'Version not found' },
				{
					status: 404
				}
			);
		}
		await db
			.update(project_stories)
			.set({
				ai_chat_id: last?.ai_chat ?? null
			})
			.where(eq(project_stories.id, storyId));
		if (!last?.ai_chat) {
			restartMode = removedSource === 'ai_advice' ? 'advice' : 'generate';
		}
	}

	await requireCredits(user.id, 5);

	const result = await trackGeneration('story', storyId, mode ?? 'followup', () =>
		restartMode
			? generateProfileStory(storyId, {
					mode: restartMode,
					instructions: followupRequest
				})
			: createProfileStoryFollowup(
					storyId,
					followupRequest,
					includeOriginalContext,
					updateContent,
					mode
				)
	);

	if (!result.success) return json(result, { status: 422 });
	return json(result);
};
